// Build Lab: build a vSphere environment step by step, like a PC-build game.
// Pick a supported version, buy hardware, choose storage, cable it, plan VLANs, install ESX(i),
// deploy vCenter, configure the cluster, then stress-test what you built.
// Version facts checked Nov 2026: vSphere 9.1 latest (GA May 2026), 9.0 (GA Jun 2025, support to Sep 2027),
// 8.0 U3 (support to 11 Oct 2027). vSphere 7.0 general support ended 2 Oct 2025.
window.BuildLab = (() => {
  'use strict';
  const KEY = 'vmware.build.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ---------------------------------------------------------------- reference data
  const VERSIONS = {
    '9.1': { label: 'vSphere 9.1', esx: 'ESX 9.1', vc: 'vCenter 9.1', tag: 'Latest', support: 'General support to Aug 2028', nine: true,
      notes: ['Hypervisor is called ESX again (not ESXi).', 'Host lifecycle uses vLCM images only.', 'Licence vCenter; hosts are licensed through it.', 'Sold in VCF / VVF bundles; can be deployed with the VCF Installer.'] },
    '9.0': { label: 'vSphere 9.0', esx: 'ESX 9.0', vc: 'vCenter 9.0', tag: 'Supported', support: 'General support to Sep 2027', nine: true,
      notes: ['First 9.x release (Jun 2025).', 'vLCM images only; baselines removed.', 'vCenter 9 manages ESX 8.0 and newer only.', 'Can be deployed with the VCF Installer.'] },
    '8.0': { label: 'vSphere 8.0 U3', esx: 'ESXi 8.0 U3', vc: 'vCenter 8.0 U3', tag: 'Supported · your environment', support: 'General support to 11 Oct 2027', nine: false,
      notes: ['What your company runs today (8.0 U3).', 'vLCM baselines still work but are deprecated: use images.', 'Licence keys go on vCenter and on each host.', 'Deployed with the vCenter Server Appliance (VCSA) installer.'] },
  };
  const SCEN = {
    branch: { label: 'Branch office', vms: 30, vcpu: 2, ram: 8, tb: 6, ratio: 4, budget: 2000, blurb: '30 small VMs (2 vCPU, 8 GB), 6 TB. Tight budget.' },
    prod: { label: 'Production cluster', vms: 200, vcpu: 4, ram: 16, tb: 40, ratio: 4, budget: 6000, blurb: '200 VMs (4 vCPU, 16 GB), 40 TB. Must survive any single failure.' },
    sql: { label: 'SQL cluster', vms: 16, vcpu: 8, ram: 64, tb: 20, ratio: 2, budget: 3500, blurb: '16 database VMs (8 vCPU, 64 GB), 20 TB. Latency matters.' },
  };
  const OPT = {
    model: [['current', 'Current-gen 2U server', 'e.g. DL380 Gen11 / R760', 160], ['older', 'Previous-gen 2U server', 'e.g. DL380 Gen10 / R740, cheaper', 90], ['mixed', 'Half current, half previous', 'Uses leftover hardware', 125]],
    cpu: [['16', '2 × 16 cores', '32 cores per host', 0], ['24', '2 × 24 cores', '48 cores per host', 60], ['32', '2 × 32 cores', '64 cores per host', 120]],
    ram: [['256', '256 GB', '', 40], ['512', '512 GB', '', 80], ['1024', '1 TB', '', 160], ['2048', '2 TB', '', 320]],
    nic: [['2x1', '2 × 1GbE', 'Onboard only', 0], ['2x10', '2 × 10GbE', '', 20], ['4x10', '4 × 10GbE', '', 40], ['2x25', '2 × 25GbE', '', 45], ['4x25', '4 × 25GbE', '', 85]],
    hba: [['none', 'No HBA', '', 0], ['fc32', 'Dual-port 32Gb FC HBA', '', 60]],
    boot: [['m2', 'Mirrored M.2 boot (BOSS / NS204i)', 'Durable, recommended', 15], ['raid', '2 local SSDs in RAID 1', 'Durable', 25], ['sd', 'Dual SD card module', 'Cheapest', 0]],
    vsanDisk: 140, // per host, vSAN-certified NVMe set
  };
  const STORE = [
    ['fc', 'Fibre Channel SAN', 'Block storage over a dedicated FC fabric. Needs HBAs and FC switches. What your company uses.'],
    ['iscsi', 'iSCSI SAN', 'Block storage over Ethernet. Needs VMkernel ports with port binding.'],
    ['nfs', 'NFS NAS', 'File storage over Ethernet. Simple to run. Mounted the same on every host.'],
    ['vsan', 'vSAN', 'Builds shared storage from the hosts\' own disks. Needs 3+ hosts, certified disks and 10GbE+ (25GbE for ESA).'],
  ];
  const VC_SIZES = [['tiny', 'Tiny', 10, 100, '2 vCPU, 14 GB'], ['small', 'Small', 100, 1000, '4 vCPU, 21 GB'], ['medium', 'Medium', 400, 4000, '8 vCPU, 30 GB'], ['large', 'Large', 1000, 10000, '16 vCPU, 39 GB'], ['xlarge', 'X-Large', 2000, 35000, '24 vCPU, 58 GB']];
  const STEPS = ['Mission', 'Hardware', 'Storage', 'Cabling', 'Network plan', 'Install hosts', 'Deploy vCenter', 'Configure', 'Go live'];

  const fresh = () => ({
    step: 0, maxStep: 0, v: '', scen: '',
    hw: { hosts: 3, model: '', cpu: '', ram: '', nic: '', hba: '', boot: '' },
    st: { type: '', tor: 2, fcsw: 2, oob: true },
    wire: {}, sel: null,
    net: { mgmt: 10, vmotion: 20, storage: 30, vm: 100, mtu: 1500, trunk: false, jumbo: false },
    esx: { fqdn: false, dnsA: false, dnsPtr: false, ntp: false, vlan: 'match', pw: false, ssh: true, bios: 'balanced', image: 'generic' },
    vc: { method: '', size: '', target: '', sso: 'vsphere.local', dns: false, ntp: false, pg: 'mgmt' },
    cfg: { cluster: false, addHosts: false, vlcm: '', evc: false, ha: false, ac: false, drs: '', vds: false, migrate: false, vmotionVmk: false, storageVmk: false, datastore: false, psp: '', license: false, backup: false },
    tests: {},
  });
  let S = fresh();
  const load = () => { try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.hw) S = Object.assign(fresh(), x); } catch { /* ignore */ } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };

  // ---------------------------------------------------------------- derived values
  const ver = () => VERSIONS[S.v] || VERSIONS['8.0'];
  const sc = () => SCEN[S.scen] || SCEN.branch;
  const find = (list, v) => list.find((o) => o[0] === v);
  const nicCount = () => (S.hw.nic ? +S.hw.nic[0] : 0);
  const nicSpeed = () => (S.hw.nic ? +S.hw.nic.split('x')[1] : 0);
  const ports = () => {
    const p = [];
    for (let i = 0; i < nicCount(); i++) p.push({ id: 'vmnic' + i, kind: 'nic', label: 'vmnic' + i });
    if (S.hw.hba === 'fc32') { p.push({ id: 'hba0', kind: 'hba', label: 'HBA port 1' }); p.push({ id: 'hba1', kind: 'hba', label: 'HBA port 2' }); }
    p.push({ id: 'bmc', kind: 'bmc', label: 'iLO / iDRAC' });
    return p;
  };
  const targets = () => {
    const t = [];
    if (S.st.tor >= 1) t.push({ id: 'torA', kind: 'tor', label: 'Ethernet switch A', s1: 'LAN', s2: 'A' });
    if (S.st.tor >= 2) t.push({ id: 'torB', kind: 'tor', label: 'Ethernet switch B', s1: 'LAN', s2: 'B' });
    if (S.st.fcsw >= 1) t.push({ id: 'fcA', kind: 'fc', label: 'FC switch A', s1: 'FC', s2: 'A' });
    if (S.st.fcsw >= 2) t.push({ id: 'fcB', kind: 'fc', label: 'FC switch B', s1: 'FC', s2: 'B' });
    if (S.st.oob) t.push({ id: 'oob', kind: 'oob', label: 'Mgmt (OOB) switch', s1: 'Mgmt', s2: 'OOB' });
    return t;
  };
  const cap = (hosts) => {
    const cores = hosts * 2 * (+S.hw.cpu || 0), ram = hosts * (+S.hw.ram || 0);
    return { cores, ram };
  };
  const need = () => { const s = sc(); return { cores: Math.ceil((s.vms * s.vcpu) / s.ratio), ram: s.vms * s.ram }; };
  const cost = () => {
    const h = S.hw, n = h.hosts;
    let c = 0;
    const add = (list, v) => { const o = find(list, v); if (o) c += o[3] * n; };
    add(OPT.model, h.model); add(OPT.cpu, h.cpu); add(OPT.ram, h.ram); add(OPT.nic, h.nic); add(OPT.hba, h.hba); add(OPT.boot, h.boot);
    const tb = sc().tb;
    if (S.st.type === 'fc' || S.st.type === 'iscsi') c += 500 + tb * 30;
    if (S.st.type === 'nfs') c += 350 + tb * 25;
    if (S.st.type === 'vsan') c += OPT.vsanDisk * n + Math.ceil((tb * 2) / Math.max(n, 1)) * 12 * n;
    c += S.st.tor * (nicSpeed() >= 25 ? 140 : nicSpeed() >= 10 ? 100 : 20);
    c += S.st.fcsw * 180;
    if (S.st.oob) c += 15;
    return c;
  };
  const vlans = () => {
    const l = [['mgmt', 'Management (vmk0, vCenter)'], ['vmotion', 'vMotion'], ['vm', 'VM network']];
    if (['iscsi', 'nfs'].includes(S.st.type)) l.splice(2, 0, ['storage', S.st.type === 'iscsi' ? 'iSCSI storage' : 'NFS storage']);
    if (S.st.type === 'vsan') l.splice(2, 0, ['storage', 'vSAN']);
    return l;
  };

  // ---------------------------------------------------------------- checks per step
  // Each returns [{l: 'err'|'warn'|'ok'|'info', m: message}]
  const E = (m) => ({ l: 'err', m }), Wn = (m) => ({ l: 'warn', m }), OK = (m) => ({ l: 'ok', m }), IN = (m) => ({ l: 'info', m });
  const CHECK = [
    () => {
      const r = [];
      if (!S.v) r.push(E('Pick a vSphere version.'));
      if (!S.scen) r.push(E('Pick a mission.'));
      if (S.v) r.push(OK(`${ver().label}: ${ver().support}.`));
      return r;
    },
    () => {
      const r = [], h = S.hw;
      ['model', 'cpu', 'ram', 'nic', 'hba', 'boot'].forEach((k) => { if (!h[k]) r.push(E(`Choose ${({ model: 'a server model', cpu: 'the CPUs', ram: 'the RAM', nic: 'the network cards', hba: 'whether to add an FC HBA', boot: 'a boot device' })[k]}.`)); });
      if (r.length) return r;
      const n = need(), all = cap(h.hosts), nm1 = cap(h.hosts - 1);
      if (h.hosts < 2) r.push(E('One host has no HA and no vMotion. Buy at least 2 (3 is the usual minimum).'));
      if (all.cores < n.cores || all.ram < n.ram) r.push(E(`Not enough capacity even with all hosts up. Need ~${n.cores} cores and ${n.ram} GB RAM; you have ${all.cores} cores and ${all.ram} GB.`));
      else if (nm1.cores < n.cores || nm1.ram < n.ram) r.push(Wn(`Not N+1: if one host fails, the rest cannot run everything (need ~${n.cores} cores / ${n.ram} GB with ${h.hosts - 1} hosts). HA admission control will block power-ons.`));
      else r.push(OK(`Capacity is N+1: ${h.hosts - 1} hosts can still carry ~${n.cores} cores and ${n.ram} GB.`));
      if (h.boot === 'sd') r.push(E('SD cards or USB alone are not supported as the ESXi boot device for new installs (since 7.0, ESXi writes logs and data there). Choose M.2 or local SSDs.'));
      if (h.nic === '2x1') r.push(E('1GbE is too slow for vMotion and storage traffic in a modern cluster. Choose 10GbE or 25GbE.'));
      if (h.model === 'mixed') r.push(Wn('Mixed CPU generations: you will need EVC on the cluster for vMotion to work between them.'));
      if (h.model === 'older' && ver().nine) r.push(Wn('Older servers: check every CPU, NIC and HBA on the Broadcom Compatibility Guide for 9.x before buying. Each major release drops some old hardware.'));
      if (S.scen === 'sql' && h.cpu === '16') r.push(IN('SQL is often licensed per core: fewer, faster cores can save licence cost.'));
      return r;
    },
    () => {
      const r = [], t = S.st.type;
      if (!t) return [E('Choose a storage type.')];
      if (t === 'fc' && S.hw.hba !== 'fc32') r.push(E('Fibre Channel needs an FC HBA in every host. Go back to Hardware and add one.'));
      if (t === 'fc' && S.st.fcsw === 0) r.push(E('Fibre Channel needs FC switches (the fabric).'));
      if (t === 'fc' && S.st.fcsw === 1) r.push(Wn('One FC switch is a single point of failure. Use two separate fabrics (A and B).'));
      if (t !== 'fc' && S.hw.hba === 'fc32') r.push(Wn('You bought FC HBAs but are not using Fibre Channel. Wasted money.'));
      if (t !== 'fc' && S.st.fcsw > 0) r.push(Wn('You bought FC switches but are not using Fibre Channel.'));
      if (t === 'vsan' && S.hw.hosts < 3) r.push(E('vSAN needs at least 3 hosts (or a 2-node design with a separate witness, not covered here).'));
      if (t === 'vsan' && nicSpeed() < 25) r.push(Wn('vSAN works on 10GbE, but 25GbE is recommended (and expected for vSAN ESA).'));
      if (['iscsi', 'nfs', 'vsan'].includes(t) && nicCount() < 4) r.push(Wn('Storage traffic will share 2 uplinks with everything else. 4 NICs (or 25GbE) give more headroom.'));
      if (S.st.tor === 0) r.push(E('You need at least one Ethernet switch.'));
      if (S.st.tor === 1) r.push(Wn('One Ethernet switch is a single point of failure for every host. Use two.'));
      if (!S.st.oob) r.push(Wn('No out-of-band switch: iLO/iDRAC will share the production network or go unconnected.'));
      if (S.scen === 'sql' && t === 'nfs') r.push(IN('NFS works for databases, but most SQL teams prefer block storage (FC or iSCSI) for latency.'));
      if (!r.some((x) => x.l === 'err')) r.push(OK(`${find(STORE, t)[1]} chosen.`));
      return r;
    },
    () => {
      const r = [], P = ports(), W = S.wire, T = Object.fromEntries(targets().map((t) => [t.id, t]));
      P.forEach((p) => {
        const to = W[p.id] && T[W[p.id]];
        if (!to) { r.push(p.kind === 'bmc' ? Wn(`${p.label} is not connected: no remote console if the host hangs.`) : p.kind === 'hba' && S.st.type !== 'fc' ? IN(`${p.label} unused (not using FC).`) : E(`${p.label} is not connected.`)); return; }
        if (p.kind === 'nic' && to.kind !== 'tor') r.push(E(`${p.label} is an Ethernet port; it must go to an Ethernet switch, not ${to.label}.`));
        if (p.kind === 'hba' && to.kind !== 'fc') r.push(E(`${p.label} is a Fibre Channel port; it must go to an FC switch.`));
        if (p.kind === 'bmc' && to.kind === 'fc') r.push(E('iLO/iDRAC is Ethernet; it cannot go to an FC switch.'));
        if (p.kind === 'bmc' && to.kind === 'tor') r.push(Wn('iLO/iDRAC on a production switch works, but a separate management network is safer.'));
      });
      const nics = P.filter((p) => p.kind === 'nic').map((p) => W[p.id]);
      if (S.st.tor >= 2 && nics.length && nics.every((x) => x === nics[0])) r.push(Wn('All NICs go to the same Ethernet switch. If that switch fails, the hosts are cut off. Split them across A and B.'));
      const hbas = P.filter((p) => p.kind === 'hba').map((p) => W[p.id]).filter(Boolean);
      if (S.st.type === 'fc' && S.st.fcsw >= 2 && hbas.length === 2 && hbas[0] === hbas[1]) r.push(Wn('Both HBA ports go to the same FC switch. Connect one to fabric A and one to fabric B.'));
      if (!r.some((x) => x.l === 'err' || x.l === 'warn')) r.push(OK('Cabling is redundant: no single switch or cable takes a host down.'));
      return r;
    },
    () => {
      const r = [], N = S.net, L = vlans();
      const ids = L.map(([k]) => +N[k]);
      L.forEach(([k, label]) => { const v = +N[k]; if (!(v >= 1 && v <= 4094)) r.push(E(`${label}: VLAN must be between 1 and 4094.`)); else if (v === 1) r.push(Wn(`${label}: VLAN 1 is the default VLAN on most switches. Use a dedicated VLAN.`)); });
      const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
      if (dup.length) r.push(N.vmotion === N.mgmt && new Set(ids).size === ids.length - 1 ? Wn('vMotion shares the management VLAN. It works, but large vMotions compete with management and HA heartbeats.') : E(`Two networks share VLAN ${dup[0]}. Give each network its own VLAN.`));
      if (!N.trunk) r.push(E('The physical switch ports must be trunks that allow all these VLANs. Tick it once done.'));
      if (+N.mtu === 9000 && !N.jumbo) r.push(E('MTU 9000 on vSphere but not on the physical switches: large packets get dropped. Set jumbo frames end to end, or use 1500.'));
      if (+N.mtu === 9000 && N.jumbo) r.push(OK('Jumbo frames set end to end for vMotion and storage.'));
      if (!r.some((x) => x.l === 'err')) r.push(OK('Network plan is valid.'));
      return r;
    },
    () => {
      const r = [], X = S.esx;
      if (!X.fqdn) r.push(E('Give each host a fully qualified hostname (e.g. esx01.lab.local).'));
      if (!X.dnsA) r.push(E('Create DNS A (forward) records for every host. vCenter adds hosts by name.'));
      if (!X.dnsPtr) r.push(E('Create DNS PTR (reverse) records too. Missing reverse DNS is a classic cause of failed installs.'));
      if (!X.ntp) r.push(E('Set NTP on every host. Hosts and vCenter must agree on the time (certificates, logs, AD).'));
      if (X.vlan !== 'match') r.push(E(`vmk0 must be tagged with the management VLAN (${S.net.mgmt}), or the host is unreachable.`));
      if (!X.pw) r.push(E('Set a strong root password (it is checked for complexity at install).'));
      if (X.ssh) r.push(Wn('SSH is left on. Turn it off and only enable it when needed.'));
      if (X.bios === 'saving') r.push(Wn('BIOS is on maximum power saving: expect extra latency. Use High Performance or OS Controlled.'));
      if (X.image === 'generic') r.push(Wn('Generic image: the vendor custom image (or a vLCM vendor add-on) includes the right drivers and tools for your server.'));
      if (!r.some((x) => x.l === 'err')) r.push(OK(`${ver().esx} installed on ${S.hw.hosts} hosts.`));
      return r;
    },
    () => {
      const r = [], C = S.vc, s = sc();
      if (!C.method) r.push(E('Choose how to deploy vCenter.'));
      const size = find(VC_SIZES, C.size);
      if (!size) r.push(E('Choose a vCenter size.'));
      else if (size[2] < S.hw.hosts || size[3] < s.vms) r.push(E(`${size[1]} supports ${size[2]} hosts / ${size[3]} VMs. Too small for ${S.hw.hosts} hosts and ${s.vms} VMs.`));
      else if (VC_SIZES.indexOf(size) >= 2 && VC_SIZES[VC_SIZES.indexOf(size) - 2][2] >= S.hw.hosts && VC_SIZES[VC_SIZES.indexOf(size) - 2][3] >= s.vms) r.push(Wn(`${size[1]} is far bigger than you need. It wastes host resources.`));
      if (!C.target) r.push(E('Choose where the vCenter VM will live.'));
      if (C.target === 'local') r.push(Wn('vCenter on one host\'s local disk cannot be restarted by HA elsewhere. Move it to shared storage later.'));
      if (C.target === 'shared' && S.st.type === 'vsan') r.push(E('There is no shared datastore yet with vSAN. Use the installer\'s option to bootstrap vSAN on the first host.'));
      if (C.target === 'vsan' && S.st.type !== 'vsan') r.push(E('You are not using vSAN.'));
      if (!C.dns) r.push(E('vCenter\'s FQDN must resolve forward and reverse BEFORE you deploy. The installer checks it.'));
      if (!C.ntp) r.push(E('vCenter must use the same NTP source as the hosts.'));
      if (C.pg !== 'mgmt') r.push(E('Put vCenter on the management network so it can reach the hosts\' vmk0.'));
      if (C.sso === 'ad') r.push(Wn('Do not reuse your Active Directory domain name as the SSO domain. Use vsphere.local or another unique name, and join AD as an identity source.'));
      if (!r.some((x) => x.l === 'err')) r.push(OK(`${ver().vc} deployed.`));
      return r;
    },
    () => {
      const r = [], G = S.cfg, t = S.st.type;
      if (!G.cluster) r.push(E('Create a datacenter and a cluster.'));
      if (!G.addHosts) r.push(E('Add all the hosts to the cluster.'));
      if (!G.vlcm) r.push(E('Choose how the cluster is patched (vLCM).'));
      if (G.vlcm === 'baselines' && ver().nine) r.push(E('vSphere 9 does not support baselines. The cluster must use a vLCM image.'));
      if (G.vlcm === 'baselines' && !ver().nine) r.push(Wn('Baselines are deprecated in 8.0 and gone in 9. Use a vLCM image now to make the future upgrade easy.'));
      if (S.hw.model === 'mixed' && !G.evc) r.push(E('Mixed CPU generations without EVC: vMotion (and DRS) will fail between old and new hosts.'));
      if (!G.ha) r.push(E('Turn on vSphere HA, or a host failure leaves its VMs down.'));
      if (G.ha && !G.ac) r.push(Wn('Admission control is off: after a host failure there may not be room to restart everything.'));
      if (!G.drs) r.push(E('Choose a DRS mode.'));
      if (G.drs === 'manual') r.push(Wn('DRS manual: it only recommends moves, you must click them. Fully automated is normal.'));
      if (!G.vds) r.push(Wn('Still on standard vSwitches. A distributed switch keeps every host consistent.'));
      if (G.vds && !G.migrate) r.push(E('You created a vDS but left vmk0 and VMs on the old vSwitch0. Migrate them (and their uplinks).'));
      if (!G.vmotionVmk) r.push(Wn(S.net.vmotion === S.net.mgmt ? 'vMotion will run on the management vmk. Works, but a dedicated vMotion vmk is better.' : 'No vMotion VMkernel port on the vMotion VLAN: vMotion will not use your vMotion network.'));
      if (['iscsi', 'nfs', 'vsan'].includes(t) && !G.storageVmk) r.push(E(t === 'iscsi' ? 'iSCSI needs VMkernel ports bound to the software iSCSI adapter (port binding), one active uplink each.' : t === 'nfs' ? 'NFS needs a VMkernel port on the storage VLAN.' : 'vSAN needs a VMkernel port with the vSAN service on every host.'));
      if (!G.datastore) r.push(E(t === 'vsan' ? 'Enable vSAN, claim the disks and apply a storage policy (FTT=1).' : t === 'nfs' ? 'Mount the NFS export on every host with the same datastore name.' : 'Create the VMFS 6 datastore on the LUN (zoning and LUN masking done first).'));
      if ((t === 'fc' || t === 'iscsi') && G.psp && G.psp !== 'rr') r.push(Wn('For an active/active array, Round Robin uses every path. Fixed or MRU leave paths idle.'));
      if ((t === 'fc' || t === 'iscsi') && !G.psp) r.push(E('Choose a path selection policy for the LUNs.'));
      if (!G.license) r.push(Wn(ver().nine ? 'Not licensed: apply the licence to vCenter (hosts inherit it). Evaluation mode expires.' : 'Not licensed: assign licence keys to vCenter and every host. Evaluation mode lasts 60 days.'));
      if (!G.backup) r.push(Wn('No vCenter file-based backup scheduled. If vCenter breaks, you rebuild from scratch.'));
      if (!r.some((x) => x.l === 'err' || x.l === 'warn')) r.push(OK('Cluster configured to best practice.'));
      return r;
    },
    () => [],
  ];
  const issues = (i) => CHECK[i]();
  const blocked = (i) => issues(i).some((x) => x.l === 'err');
  const overBudget = () => S.scen && cost() > sc().budget;

  // ---------------------------------------------------------------- UI helpers
  let ctx = null, root = null;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), S);
  const set = (path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => o[k], S)[last] = v; };
  const cards = (path, list, cols = '') => `<div class="bl-cards ${cols}">${list.map(([v, l, sub, c]) => `<button class="bl-card ${String(get(path)) === String(v) ? 'on' : ''}" data-k="${path}" data-v="${esc(v)}"><strong>${esc(l)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}${c !== undefined && c !== null && c !== '' ? `<em>${typeof c === 'number' ? (c ? '+' + c + ' cr' + (path.startsWith('hw.') && path !== 'hw.hosts' ? ' / host' : '') : 'included') : esc(c)}</em>` : ''}</button>`).join('')}</div>`;
  const tick = (path, label, sub = '') => `<label class="chk"><input type="checkbox" data-c="${path}" ${get(path) ? 'checked' : ''}><span>${esc(label)}${sub ? `<br><small class="muted">${esc(sub)}</small>` : ''}</span></label>`;
  const stepper = (path, min, max, label) => `<div class="bl-step"><span>${esc(label)}</span><button class="btn ghost" data-dec="${path}" data-min="${min}">−</button><strong>${get(path)}</strong><button class="btn ghost" data-inc="${path}" data-max="${max}">+</button></div>`;
  const icon = { err: '✕', warn: '⚠', ok: '✓', info: 'ℹ' };
  const checksHTML = (list) => `<div class="bl-checks">${list.map((x) => `<p class="bl-chk ${x.l}"><b>${icon[x.l]}</b>${esc(x.m)}</p>`).join('')}</div>`;
  const why = (t) => `<p class="tip">${t}</p>`;

  // ---------------------------------------------------------------- step views
  const VIEW = [
    // 0 Mission
    () => `
      <h2>1. Choose your vSphere version</h2>
      ${why('Only versions still in general support are offered. vSphere 7.0 reached end of general support on 2 Oct 2025, so it is shown greyed out.')}
      <div class="bl-cards">${Object.entries(VERSIONS).map(([k, v]) => `<button class="bl-card ${S.v === k ? 'on' : ''}" data-k="v" data-v="${k}"><strong>${v.label}</strong><small>${esc(v.support)}</small><em>${esc(v.tag)}</em></button>`).join('')}
        <button class="bl-card off" disabled><strong>vSphere 7.0</strong><small>End of general support 2 Oct 2025</small><em>EOL</em></button></div>
      ${S.v ? `<ul class="prose small">${ver().notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <h2>2. Choose your mission</h2>
      ${cards('scen', Object.entries(SCEN).map(([k, s]) => [k, s.label, s.blurb, `Budget ${s.budget} cr`]))}`,

    // 1 Hardware
    () => {
      const n = need(), a = cap(S.hw.hosts), b = cap(S.hw.hosts - 1);
      const meter = (have, needv, unit) => `<div class="w-bar"><span style="width:${Math.min(100, (100 * have) / Math.max(needv, 1))}%;background:${have >= needv ? 'var(--ok)' : 'var(--bad)'}"></span></div><small>${have} of ${needv} ${unit} needed</small>`;
      return `
      <h2>Buy your hosts</h2>
      ${why(`Mission: <strong>${esc(sc().blurb)}</strong> You need about ${n.cores} cores (at ${sc().ratio} vCPU per core) and ${n.ram} GB RAM, and you should still have that with one host down (N+1).`)}
      ${stepper('hw.hosts', 1, 8, 'Number of hosts')}
      <h3>Server</h3>${cards('hw.model', OPT.model)}
      <h3>CPUs</h3>${cards('hw.cpu', OPT.cpu)}
      <h3>RAM per host</h3>${cards('hw.ram', OPT.ram, 'four')}
      <h3>Network cards</h3>${cards('hw.nic', OPT.nic)}
      <h3>Fibre Channel HBA</h3>${cards('hw.hba', OPT.hba)}
      <h3>Boot device</h3>${cards('hw.boot', OPT.boot)}
      ${S.hw.cpu && S.hw.ram ? `<div class="bl-cap"><div><strong>All hosts up</strong>${meter(a.cores, n.cores, 'cores')}${meter(a.ram, n.ram, 'GB')}</div><div><strong>One host down (N+1)</strong>${meter(b.cores, n.cores, 'cores')}${meter(b.ram, n.ram, 'GB')}</div></div>` : ''}`;
    },

    // 2 Storage
    () => `
      <h2>Choose storage</h2>
      ${why(`Mission needs about <strong>${sc().tb} TB</strong> usable. Shared storage is what makes vMotion and HA possible: every host must see the same datastores.`)}
      ${cards('st.type', STORE.map(([k, l, d]) => [k, l, d, '']))}
      <h3>Switches</h3>
      ${stepper('st.tor', 0, 2, `Ethernet switches (${nicSpeed() >= 25 ? '25' : nicSpeed() >= 10 ? '10' : '1'}GbE)`)}
      ${stepper('st.fcsw', 0, 2, 'Fibre Channel switches')}
      ${tick('st.oob', 'Out-of-band management switch for iLO / iDRAC (+15 cr)')}`,

    // 3 Cabling
    () => {
      const P = ports(), T = targets();
      const W = 340, hostW = 300, px = (i) => 30 + (i * (hostW - 20)) / Math.max(P.length - 1, 1);
      const tx = (i) => 48 + (i * (W - 96)) / Math.max(T.length - 1, 1);
      const col = { tor: 'var(--c2)', fc: 'var(--c4)', oob: 'var(--muted)' };
      const lines = P.map((p, i) => { const to = T.findIndex((t) => t.id === S.wire[p.id]); return to < 0 ? '' : `<path d="M${px(i)} 86 C${px(i)} 140 ${tx(to)} 130 ${tx(to)} 190" class="bl-wire" style="stroke:${col[T[to].kind]}"/>`; }).join('');
      return `
      <h2>Cable it up</h2>
      ${why('Tap a port on the host, then tap the switch it plugs into. Every host is cabled the same way. Aim: no single switch or cable failure takes a host down.')}
      <svg viewBox="0 0 ${W} 240" class="d-svg bl-svg" role="group" aria-label="Cabling">
        <rect x="16" y="10" width="${hostW + 8}" height="76" rx="12" class="d-box"/><text x="${16 + (hostW + 8) / 2}" y="30" text-anchor="middle" class="d-t">Each ${esc(ver().esx.split(" ")[0])} host (×${S.hw.hosts})</text>
        ${lines}
        ${P.map((p, i) => `<g class="d-node bl-port ${S.sel === p.id ? 'sel' : ''} ${S.wire[p.id] ? 'done' : ''}" data-port="${p.id}" role="button" tabindex="0" aria-label="${esc(p.label)}"><rect x="${px(i) - 19}" y="52" width="38" height="26" rx="5" class="d-box"/><text x="${px(i)}" y="69" text-anchor="middle" class="d-s" style="font-size:8.5px">${esc(p.label.replace('HBA port ', 'HBA').replace('iLO / iDRAC', 'iLO'))}</text></g>`).join('')}
        ${T.map((t, i) => `<g class="d-node bl-tgt" data-tgt="${t.id}" role="button" tabindex="0" aria-label="${esc(t.label)}"><rect x="${tx(i) - 28}" y="190" width="56" height="40" rx="7" class="d-box" style="stroke:${col[t.kind]}"/><text x="${tx(i)}" y="207" text-anchor="middle" class="d-s">${esc(t.s1)}</text><text x="${tx(i)}" y="222" text-anchor="middle" class="d-t">${esc(t.s2)}</text></g>`).join('')}
      </svg>
      <p class="small muted center">${S.sel ? `Now tap the switch for <strong>${esc((P.find((p) => p.id === S.sel) || {}).label || '')}</strong>.` : 'Tap a port to start.'}</p>
      <div class="bl-list">${P.map((p) => `<span class="chip">${esc(p.label)} → ${S.wire[p.id] ? esc((T.find((t) => t.id === S.wire[p.id]) || { label: '?' }).label) : '<em>not connected</em>'}</span>`).join('')}</div>
      <div class="w-ctrl"><button class="btn ghost" id="bl-auto">Show me a good layout</button><button class="btn ghost" id="bl-unwire">Unplug everything</button></div>`;
    },

    // 4 Network plan
    () => `
      <h2>Plan the networks</h2>
      ${why('Each traffic type gets its own VLAN. The ESX uplinks connect to switch ports set as <strong>trunks</strong>, and each port group tags its VLAN.')}
      <table class="summary bl-vlan">${vlans().map(([k, l]) => `<tr><th>${esc(l)}</th><td><input type="number" min="1" max="4094" data-n="net.${k}" value="${esc(S.net[k])}" aria-label="${esc(l)} VLAN"></td></tr>`).join('')}</table>
      <h3>MTU for vMotion${S.st.type !== 'fc' ? ' and storage' : ''}</h3>
      ${cards('net.mtu', [[1500, '1500 (standard)', 'Works everywhere', ''], [9000, '9000 (jumbo frames)', 'Less CPU per GB moved, but must match end to end', '']])}
      ${tick('net.trunk', 'Physical switch ports are trunks allowing these VLANs')}
      ${+S.net.mtu === 9000 ? tick('net.jumbo', 'Jumbo frames (MTU 9000+) set on the physical switches too') : ''}`,

    // 5 Install hosts
    () => `
      <h2>Install ${esc(ver().esx)} on every host</h2>
      ${why('Boot each host from the installer (through iLO/iDRAC virtual media), install to the boot device, then set the management network in the console (DCUI). Most failed vCenter deployments trace back to DNS or time.')}
      <h3>Installer image</h3>
      ${cards('esx.image', [['vendor', 'Vendor custom image', 'HPE / Dell drivers and tools included', ''], ['generic', 'Generic VMware image', 'Missing some vendor drivers', '']])}
      <h3>BIOS power profile</h3>
      ${cards('esx.bios', [['perf', 'High Performance / OS Controlled', '', ''], ['balanced', 'Balanced (default)', '', ''], ['saving', 'Maximum power saving', '', '']])}
      <h3>Management network (vmk0)</h3>
      ${cards('esx.vlan', [['match', `VLAN ${S.net.mgmt} (management)`, 'Matches the plan', ''], ['none', 'No VLAN tag', 'Untagged', ''], ['vm', `VLAN ${S.net.vm} (VM network)`, '', '']])}
      <h3>Checklist</h3>
      ${tick('esx.fqdn', 'Hostname set as FQDN (esx01.lab.local)')}
      ${tick('esx.dnsA', 'DNS A record created for each host')}
      ${tick('esx.dnsPtr', 'DNS PTR (reverse) record created for each host')}
      ${tick('esx.ntp', 'NTP server set and the service started')}
      ${tick('esx.pw', 'Strong root password set')}
      ${tick('esx.ssh', 'SSH left enabled')}`,

    // 6 Deploy vCenter
    () => {
      const methods = ver().nine
        ? [['vcf', 'VCF Installer', 'Deploys vCenter (and VCF Operations) for VCF/VVF', ''], ['vcsa', 'vCenter installer (VCSA ISO)', 'Stage 1 deploy, Stage 2 configure', '']]
        : [['vcsa', 'vCenter Server Appliance installer', 'Stage 1: deploy the appliance. Stage 2: set up SSO and NTP', '']];
      const targetsList = [['local', 'Local disk of host 1', 'Quick, but not protected by HA', ''], ['shared', S.st.type === 'nfs' ? 'NFS datastore' : 'Shared VMFS datastore', 'LUN presented and formatted from the host client first', '']];
      if (S.st.type === 'vsan') targetsList.push(['vsan', 'Bootstrap vSAN on host 1', 'The installer builds a 1-host vSAN, you add the rest later', '']);
      return `
      <h2>Deploy ${esc(ver().vc)}</h2>
      ${why('vCenter is a Linux appliance (VCSA) that runs as a VM on one of your hosts. That is the chicken-and-egg moment: you deploy it to a single host before any cluster exists.')}
      <h3>Method</h3>${cards('vc.method', methods)}
      <h3>Size</h3>${cards('vc.size', VC_SIZES.map(([k, l, h, v, r]) => [k, l, `Up to ${h} hosts / ${v.toLocaleString()} VMs · ${r}`, '']))}
      <p class="small muted">Sizes from the vCenter 8 documentation. You need ${S.hw.hosts} hosts and ${sc().vms} VMs.</p>
      <h3>Where does the vCenter VM live?</h3>${cards('vc.target', targetsList)}
      <h3>SSO domain</h3>${cards('vc.sso', [['vsphere.local', 'vsphere.local', 'The default', ''], ['ad', 'corp.example.com', 'Same name as Active Directory', '']])}
      <h3>vCenter VM network</h3>${cards('vc.pg', [['mgmt', `Management (VLAN ${S.net.mgmt})`, '', ''], ['vm', `VM network (VLAN ${S.net.vm})`, '', '']])}
      <h3>Before you click Deploy</h3>
      ${tick('vc.dns', 'vCenter FQDN resolves forward and reverse in DNS')}
      ${tick('vc.ntp', 'vCenter uses the same NTP source as the hosts')}`;
    },

    // 7 Configure
    () => {
      const t = S.st.type;
      const storeLabel = t === 'iscsi' ? 'Two iSCSI VMkernel ports bound to the software iSCSI adapter' : t === 'nfs' ? 'NFS VMkernel port on the storage VLAN' : t === 'vsan' ? 'vSAN VMkernel port on every host' : '';
      const dsLabel = t === 'vsan' ? 'vSAN enabled, disks claimed, policy FTT=1' : t === 'nfs' ? 'NFS export mounted on all hosts with the same name' : t === 'iscsi' ? 'iSCSI target added, LUN scanned, VMFS 6 datastore created' : 'Zoning and LUN masking done, VMFS 6 datastore created';
      return `
      <h2>Configure the environment in vCenter</h2>
      ${why('Log in to the vSphere Client. Build the inventory, the cluster, the distributed switch and the storage, then protect it.')}
      <h3>Inventory</h3>
      ${tick('cfg.cluster', 'Create a datacenter and a cluster')}
      ${tick('cfg.addHosts', `Add all ${S.hw.hosts} hosts to the cluster`)}
      <h3>Lifecycle (vLCM)</h3>
      ${cards('cfg.vlcm', [['images', 'Image', 'ESX version + vendor add-on + drivers/firmware', ''], ['baselines', 'Baselines', ver().nine ? 'Removed in vSphere 9' : 'Deprecated (old Update Manager style)', '']])}
      <h3>Cluster services</h3>
      ${tick('cfg.ha', 'vSphere HA on')}
      ${tick('cfg.ac', 'HA admission control on (tolerate 1 host failure)')}
      ${tick('cfg.evc', 'EVC mode set to the oldest CPU generation in the cluster')}
      ${cards('cfg.drs', [['auto', 'DRS fully automated', '', ''], ['partial', 'DRS partially automated', '', ''], ['manual', 'DRS manual', '', '']])}
      ${ver().nine ? '<p class="small muted">vCLS (the small DRS helper VMs) is deprecated in 9.0, and clusters can run without it.</p>' : '<p class="small muted">vSphere 8 deploys small vCLS VMs for DRS. Leave them alone.</p>'}
      <h3>Networking</h3>
      ${tick('cfg.vds', 'Create a distributed switch with port groups for each VLAN, add the hosts')}
      ${S.cfg.vds ? tick('cfg.migrate', 'Migrate vmk0, the VM networks and the uplinks from vSwitch0 to the vDS') : ''}
      ${tick('cfg.vmotionVmk', `vMotion VMkernel port on VLAN ${S.net.vmotion}${+S.net.mtu === 9000 ? ', MTU 9000' : ''}`)}
      ${storeLabel ? tick('cfg.storageVmk', storeLabel) : ''}
      <h3>Storage</h3>
      ${tick('cfg.datastore', dsLabel)}
      ${t === 'fc' || t === 'iscsi' ? cards('cfg.psp', [['rr', 'Round Robin', 'Uses all active paths', ''], ['fixed', 'Fixed', 'One preferred path', ''], ['mru', 'Most Recently Used', 'Last working path', '']]) : ''}
      <h3>Protect it</h3>
      ${tick('cfg.license', ver().nine ? 'Licence applied to vCenter (hosts inherit it)' : 'Licence keys assigned to vCenter and every host')}
      ${tick('cfg.backup', 'vCenter file-based backup scheduled (VAMI)')}`;
    },

    // 8 Go live
    () => {
      const all = [1, 2, 3, 4, 5, 6, 7].flatMap((i) => issues(i).filter((x) => x.l === 'warn').map((x) => ({ ...x, s: STEPS[i] })));
      const score = Math.max(0, 100 - all.length * 6 - (overBudget() ? 20 : 0));
      const grade = score >= 90 ? 'Architect level' : score >= 75 ? 'Solid build' : score >= 55 ? 'Works, with risks' : 'Fragile';
      const T = [
        ['host', 'Power off one host'], ['tor', 'Ethernet switch A dies'], ['fc', S.st.type === 'fc' ? 'FC fabric A dies' : 'Storage path fails'], ['vc', 'vCenter VM crashes'], ['vmo', 'vMotion a VM across hosts'],
      ];
      return `
      <h2>Go live</h2>
      <div class="score"><span class="num">${score}</span><span>${grade}</span></div>
      <table class="summary">
        <tr><th>Version</th><td>${esc(ver().label)} (${esc(ver().esx)}, ${esc(ver().vc)})</td></tr>
        <tr><th>Hosts</th><td>${S.hw.hosts} × ${esc(find(OPT.model, S.hw.model)[1])}, ${esc(find(OPT.cpu, S.hw.cpu)[1])}, ${esc(find(OPT.ram, S.hw.ram)[1])}, ${esc(find(OPT.nic, S.hw.nic)[1])}</td></tr>
        <tr><th>Storage</th><td>${esc(find(STORE, S.st.type)[1])}</td></tr>
        <tr><th>Budget</th><td>${cost()} of ${sc().budget} cr ${overBudget() ? '<strong class="bad">over budget</strong>' : ''}</td></tr>
      </table>
      <h3>Risks left (${all.length})</h3>
      ${all.length ? checksHTML(all.map((x) => ({ l: 'warn', m: `${x.s}: ${x.m}` }))) : '<p class="bl-chk ok"><b>✓</b>No known risks.</p>'}
      <h3>Stress test your build</h3>
      <p class="small muted">Break something and see if your design survives.</p>
      <div class="w-ctrl">${T.map(([k, l]) => `<button class="btn ghost" data-test="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="w-panel">${Object.keys(S.tests).length ? T.filter(([k]) => S.tests[k]).map(([k, l]) => { const o = stress(k); return `<div class="w-info"><strong>${o.ok ? '✓' : '✕'} ${esc(l)}</strong><p>${esc(o.m)}</p></div>`; }).join('') : ''}</div>
      <div class="w-ctrl"><button class="btn" id="bl-reset">Build again from scratch</button></div>`;
    },
  ];

  function stress(k) {
    const G = S.cfg, W = S.wire, n = need(), b = cap(S.hw.hosts - 1);
    if (k === 'host') {
      if (!G.ha) return { ok: false, m: 'HA is off, so the VMs on that host stay down until someone restarts them by hand.' };
      if (b.cores < n.cores || b.ram < n.ram) return { ok: false, m: `HA restarts VMs on the other ${S.hw.hosts - 1} hosts, but they lack capacity: some VMs cannot restart${G.ac ? ' (admission control would have warned you earlier by blocking power-ons)' : ''}.` };
      return { ok: true, m: `HA restarts the failed host's VMs on the other ${S.hw.hosts - 1} hosts within a few minutes. Short outage, then everything runs again.` };
    }
    if (k === 'tor') {
      const nics = ports().filter((p) => p.kind === 'nic').map((p) => W[p.id]);
      if (S.st.tor < 2) return { ok: false, m: 'You have only one Ethernet switch. Every host loses its network: management, vMotion, VM traffic' + (S.st.type !== 'fc' ? ' and storage' : '') + '.' };
      if (nics.every((x) => x === 'torA')) return { ok: false, m: 'All NICs were on switch A, so every host is cut off. HA sees all hosts isolated.' };
      return { ok: true, m: 'NIC teaming fails over to the uplinks on switch B. VMs keep running, with half the bandwidth.' };
    }
    if (k === 'fc') {
      if (S.st.type === 'vsan') return { ok: true, m: 'vSAN keeps a second copy of each object on another host (FTT=1), and traffic fails over to the other uplink.' };
      if (S.st.type === 'fc') {
        const h = [W.hba0, W.hba1];
        if (S.st.fcsw < 2 || h[0] === h[1]) return { ok: false, m: 'Both paths went through fabric A: All Paths Down (APD). VMs on the SAN freeze until the fabric returns.' };
        return { ok: true, m: `Path through fabric A is lost; ${G.psp === 'rr' ? 'Round Robin' : 'the multipathing plugin'} carries on over fabric B. VMs keep running.` };
      }
      const nics = ports().filter((p) => p.kind === 'nic').map((p) => W[p.id]);
      if (S.st.tor < 2 || nics.every((x) => x === nics[0])) return { ok: false, m: 'Storage traffic had no second path. Datastores go All Paths Down.' };
      return { ok: true, m: S.st.type === 'iscsi' ? 'Port binding gives each iSCSI vmk its own uplink, so the second path keeps I/O flowing.' : 'NFS traffic fails over to the uplink on the other switch.' };
    }
    if (k === 'vc') {
      return { ok: G.backup, m: `VMs keep running and HA still protects them (it does not need vCenter once configured). You lose management, DRS and vMotion until vCenter is back. ${S.vc.target === 'local' ? 'vCenter sits on a local disk, so HA cannot restart it on another host. ' : 'HA restarts the vCenter VM on another host. '}${G.backup ? 'If it is corrupt, you restore from the file-based backup.' : 'With no backup, a corrupt vCenter means rebuilding it and re-adding every host.'}` };
    }
    if (k === 'vmo') {
      if (S.hw.model === 'mixed' && !G.evc) return { ok: false, m: 'Fails: the old and new hosts have different CPU features and EVC is off.' };
      if (G.vds && !G.migrate) return { ok: false, m: 'Fails on some hosts: VM networks are still split between vSwitch0 and the vDS.' };
      return { ok: true, m: `Works. Memory is copied over ${G.vmotionVmk ? 'the dedicated vMotion network' : 'the management network'}${nicSpeed() >= 25 ? ' at 25GbE' : ''}, then the VM switches host with a sub-second pause.` };
    }
    return { ok: true, m: '' };
  }

  // ---------------------------------------------------------------- render
  function render(keepScroll) {
    const y = window.scrollY;
    const i = S.step;
    const list = issues(i).concat(i === 1 || i === 2 ? (overBudget() ? [E(`Over budget: ${cost()} of ${sc().budget} cr. Cut something.`)] : S.scen ? [IN(`Spent ${cost()} of ${sc().budget} cr.`)] : []) : []);
    const canNext = i < STEPS.length - 1 && !list.some((x) => x.l === 'err');
    ctx.show(`
      <section class="card bl">
        <p class="kicker">Build Lab · ${S.v ? esc(ver().label) : 'vSphere'}${S.scen ? ' · ' + esc(sc().label) : ''}</p>
        <div class="bl-steps">${STEPS.map((s, k) => `<button class="bl-pill ${k === i ? 'cur' : ''} ${k < i ? 'done' : ''}" data-go="${k}" ${k > S.maxStep ? 'disabled' : ''}>${k + 1}. ${esc(s)}</button>`).join('')}</div>
        ${S.scen && i >= 1 && i <= 7 ? `<div class="bl-budget"><span>Budget</span><div class="w-bar"><span style="width:${Math.min(100, (100 * cost()) / sc().budget)}%;background:${overBudget() ? 'var(--bad)' : 'var(--accent)'}"></span></div><strong>${cost()} / ${sc().budget} cr</strong></div>` : ''}
        <div class="bl-body">${VIEW[i]()}</div>
        ${i < STEPS.length - 1 ? `<h3>Checks</h3>${checksHTML(list)}` : ''}
        <div class="nav"><button class="btn" id="bl-back">${i === 0 ? '← Home' : '← Back'}</button>${i < STEPS.length - 1 ? `<button class="btn primary" id="bl-next" ${canNext ? '' : 'disabled'}>${canNext ? 'Next: ' + esc(STEPS[i + 1]) + ' →' : 'Fix the ✕ items first'}</button>` : ''}</div>
      </section>
      <div id="coach"></div>`, 'Build Lab');
    if (keepScroll) window.scrollTo(0, y);
    bind(list);
  }

  function bind(list) {
    const rerender = () => { save(); render(true); };
    $$('[data-k]', root).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k, v = b.dataset.v;
      set(k, k === 'net.mtu' ? +v : v);
      if (k === 'hw.nic' || k === 'hw.hba' || k === 'st.tor' || k === 'st.fcsw' || k === 'st.oob') S.wire = {};
      rerender();
    }));
    $$('[data-c]', root).forEach((c) => (c.onchange = () => { set(c.dataset.c, c.checked); if (c.dataset.c === 'st.oob') S.wire = {}; rerender(); }));
    $$('[data-n]', root).forEach((c) => (c.onchange = () => { set(c.dataset.n, +c.value); rerender(); }));
    $$('[data-inc]', root).forEach((b) => (b.onclick = () => { const k = b.dataset.inc; set(k, Math.min(+b.dataset.max, get(k) + 1)); if (k.startsWith('st.')) S.wire = {}; rerender(); }));
    $$('[data-dec]', root).forEach((b) => (b.onclick = () => { const k = b.dataset.dec; set(k, Math.max(+b.dataset.min, get(k) - 1)); if (k.startsWith('st.')) S.wire = {}; rerender(); }));
    const act = (sel, fn) => $$(sel, root).forEach((g) => { g.onclick = () => fn(g); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(g); } }; });
    act('[data-port]', (g) => { S.sel = S.sel === g.dataset.port ? null : g.dataset.port; rerender(); });
    act('[data-tgt]', (g) => { if (!S.sel) return; S.wire[S.sel] = g.dataset.tgt; S.sel = null; rerender(); });
    const auto = $('#bl-auto'); if (auto) auto.onclick = () => {
      const T = targets().map((t) => t.id), w = {};
      let n = 0;
      ports().forEach((p) => {
        if (p.kind === 'nic') w[p.id] = T.includes('torB') && n++ % 2 ? 'torB' : 'torA';
        if (p.kind === 'hba' && S.st.type === 'fc') w[p.id] = p.id === 'hba1' && T.includes('fcB') ? 'fcB' : 'fcA';
        if (p.kind === 'bmc') w[p.id] = T.includes('oob') ? 'oob' : 'torA';
      });
      S.wire = w; S.sel = null; rerender();
    };
    const un = $('#bl-unwire'); if (un) un.onclick = () => { S.wire = {}; S.sel = null; rerender(); };
    $$('[data-test]', root).forEach((b) => (b.onclick = () => { S.tests[b.dataset.test] = true; rerender(); }));
    $$('[data-go]', root).forEach((b) => (b.onclick = () => { S.step = +b.dataset.go; save(); render(); }));
    $('#bl-back').onclick = () => { if (S.step === 0) ctx.go(ctx.home); else { S.step--; save(); render(); } };
    const nx = $('#bl-next'); if (nx) nx.onclick = () => { S.step++; S.maxStep = Math.max(S.maxStep, S.step); S.sel = null; save(); render(); };
    const rs = $('#bl-reset'); if (rs) rs.onclick = () => { if (confirm('Start a new build? Your current build will be cleared.')) { S = fresh(); save(); render(); } };

    // coach for this step
    const st = S.step;
    ctx.coach.mount($('#coach', root), {
      id: 'build-' + st, title: 'Ask the coach about this step',
      intro: 'Not sure why a choice matters? Ask me. I can see your build and the checks.',
      placeholder: 'Ask about this step…',
      systemPrompt: () => `${ctx.BASE}\n\nThe learner is playing "Build Lab", a game where they design and build a vSphere environment step by step. Current step: ${STEPS[st]}.\nTheir build so far: version ${S.v ? ver().label : 'not chosen'}; mission ${S.scen ? sc().label + ' (' + sc().blurb + ')' : 'not chosen'}; ${S.hw.hosts} hosts, model ${S.hw.model || '?'}, CPU ${S.hw.cpu || '?'} cores/socket, RAM ${S.hw.ram || '?'} GB, NICs ${S.hw.nic || '?'}, HBA ${S.hw.hba || '?'}, boot ${S.hw.boot || '?'}; storage ${S.st.type || '?'}, ${S.st.tor} Ethernet switches, ${S.st.fcsw} FC switches.\nCurrent checks shown to them: ${list.map((x) => `[${x.l}] ${x.m}`).join(' | ') || 'none'}.\nExplain WHY each check matters in real life, simply. Guide them to fix errors by asking questions; do not just list the answer unless they ask. Version facts you may rely on: vSphere 9.1 is the latest (GA May 2026), 9.0 GA Jun 2025, 8.0 U3 supported to 11 Oct 2027, vSphere 7 general support ended 2 Oct 2025; vSphere 9 uses vLCM images only and vCenter 9 manages ESX 8.0+.`,
      chips: () => [['Why does this step matter?', `Why does the "${STEPS[st]}" step matter in a real project? Keep it short.`], ['Explain the ✕ and ⚠ items', 'Explain the errors and warnings on this step in simple words, and how I would fix them.'], ['How is this done at work?', `How would this "${STEPS[st]}" step look in a real company, for example one like mine with HPE/Dell servers and a Hitachi FC SAN?`], ['Quiz me on this step', 'Ask me one question about this step, wait for my answer, then give feedback.']],
    });
  }

  function start(appEl, c) {
    root = appEl; ctx = c; load(); render();
  }
  return { start, _state: () => S, _issues: issues };
})();
