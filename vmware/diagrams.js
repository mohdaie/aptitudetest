// VMware prep: interactive diagrams. Each widget is a function (el) => void that draws into el and binds its own events.
// Everything is plain SVG/HTML with no libraries, tap-friendly, and keyboard-accessible.
window.VMW = window.VMW || {};
VMW.WIDGETS = {};
VMW.WIDGET_TITLES = {};

(() => {
  'use strict';
  const W = VMW.WIDGETS;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $$ = (s, el) => Array.from(el.querySelectorAll(s));
  const tap = (root, sel, fn) => $$(sel, root).forEach((g) => {
    g.addEventListener('click', () => fn(g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(g); } });
  });
  const frame = (key, title, hint, inner) => `<div class="widget" data-wid="${key}"><div class="w-title">${esc(title)}</div><p class="w-hint">${esc(hint)}</p>${inner}</div>`;
  const node = (id, x, y, w, h, label, sub, cls = '') => `<g class="d-node ${cls}" data-p="${id}" role="button" tabindex="0" aria-label="${esc(label)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="d-box"/><text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" text-anchor="middle" class="d-t">${esc(label)}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" class="d-s">${esc(sub)}</text>` : ''}</g>`;
  const line = (d, cls = '') => `<path d="${d}" class="d-line ${cls}" fill="none"/>`;
  const info = (t, body) => `<div class="w-info"><strong>${esc(t)}</strong><p>${body}</p></div>`;

  // ============================================================ 1. Inside a server
  VMW.WIDGET_TITLES.server = 'Inside a host (tap a part)';
  W.server = (el) => {
    const INFO = {
      cpu1: ['CPU socket 1', 'A physical processor chip. Your newest hosts have 32 cores per socket (64 per host). ESXi runs the VMs\' vCPUs on these cores.'],
      cpu2: ['CPU socket 2', 'The second chip. Two sockets is normal for a DL380 or R640/R740. Each socket has its own memory.'],
      ram1: ['RAM, NUMA node 1', 'Memory attached to socket 1. It is fast for socket 1 and slower when socket 2 reaches over. Hosts hold 1 to 2 TB in total.'],
      ram2: ['RAM, NUMA node 2', 'Memory attached to socket 2. A socket plus its own memory is one NUMA node.'],
      hba: ['HBA (Fibre Channel card)', 'Connects the host to the SAN. Your hosts have 4 or 8 FC ports at 16 or 32 Gb. This is the road to your datastores.'],
      nic: ['NIC (network card)', 'Connects the host to the network: management, vMotion and VM traffic. Most of your hosts use 10GbE.'],
      ilo: ['iLO (HPE) / iDRAC (Dell)', 'A small separate computer with its own network port. It works even when ESXi is dead: console, power on/off, hardware health.'],
      raid: ['RAID controller and boot disks', 'Local disks where ESXi itself is installed. The VMs\' disks are on the SAN, not here.'],
    };
    const part = (id, x, y, w, h, label, extra = '') => `<g class="d-node" data-p="${id}" role="button" tabindex="0" aria-label="${esc(label)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="d-box"/><text x="${x + w / 2}" y="${y + 15}" text-anchor="middle" class="d-t">${esc(label)}</text>${extra}</g>`;
    const cores = (x) => [0, 1, 2, 3].map((i) => [0, 1].map((j) => `<rect x="${x + 12 + i * 30}" y="${40 + j * 22}" width="24" height="16" rx="3" class="d-core"/>`).join('')).join('');
    const dimms = (x) => [0, 1, 2, 3].map((i) => `<rect x="${x + 14 + i * 31}" y="${126}" width="22" height="14" rx="2" class="d-core"/>`).join('');
    el.innerHTML = frame('server', 'Inside a host', 'Tap any part to see what it does in your environment.', `
      <svg viewBox="0 0 340 270" class="d-svg" role="group" aria-label="Server diagram">
        <rect x="4" y="4" width="332" height="262" rx="14" class="d-chassis"/>
        ${part('cpu1', 16, 16, 140, 78, 'CPU socket 1', cores(16))}
        ${part('cpu2', 184, 16, 140, 78, 'CPU socket 2', cores(184))}
        <path d="M156 55 H184" class="d-line"/><text x="170" y="48" text-anchor="middle" class="d-s">link</text>
        ${part('ram1', 16, 104, 140, 46, 'RAM · node 1', dimms(16))}
        ${part('ram2', 184, 104, 140, 46, 'RAM · node 2', dimms(184))}
        ${part('hba', 16, 164, 92, 40, 'HBA (FC)')}
        ${part('nic', 124, 164, 92, 40, 'NIC')}
        ${part('ilo', 232, 164, 92, 40, 'iLO / iDRAC')}
        ${part('raid', 16, 216, 140, 38, 'RAID + boot disks')}
        <g><rect x="184" y="216" width="140" height="38" rx="9" class="d-box d-plain"/><text x="254" y="239" text-anchor="middle" class="d-s">2 × power supplies, fans</text></g>
      </svg>
      <div class="w-panel" aria-live="polite">${info('Tap a part', 'Try the CPU, the RAM or the HBA first.')}</div>`);
    tap(el, '[data-p]', (g) => {
      $$('[data-p]', el).forEach((x) => x.classList.toggle('sel', x === g));
      const [t, b] = INFO[g.dataset.p];
      el.querySelector('.w-panel').innerHTML = info(t, b);
    });
  };

  // ============================================================ 2. NUMA simulator
  VMW.WIDGET_TITLES.numa = 'NUMA: does the VM fit? (sliders)';
  W.numa = (el) => {
    const NODE_CORES = 32, NODE_GB = 1024;
    let v = 8, r = 64;
    el.innerHTML = frame('numa', 'NUMA simulator', 'The host has 2 sockets × 32 cores and 2 TB RAM. Change the VM size and watch where it lands.', `
      <label class="w-range"><span>vCPUs: <strong id="nv">8</strong></span><input type="range" id="sv" min="1" max="64" value="8"></label>
      <label class="w-range"><span>RAM: <strong id="nr">64</strong> GB</span><input type="range" id="sr" min="4" max="1536" step="4" value="64"></label>
      <div class="numa" id="nb"></div><div class="w-panel" id="nm" aria-live="polite"></div>`);
    const draw = () => {
      const fits = v <= NODE_CORES && r <= NODE_GB;
      const c0 = Math.min(v, NODE_CORES), c1 = Math.max(0, v - NODE_CORES);
      const m0 = Math.min(r, NODE_GB), m1 = Math.max(0, r - NODE_GB);
      const cc = (n) => Array.from({ length: 8 }, (_, i) => `<i class="${i < Math.ceil((n / NODE_CORES) * 8) ? 'on' : ''}"></i>`).join('');
      const bar = (g) => `<div class="w-bar"><span style="width:${Math.min(100, (100 * g) / NODE_GB)}%"></span></div>`;
      const node = (n, c, m) => `<div class="numa-node ${fits ? (n === 0 ? 'hot' : '') : 'hot span'}"><strong>Node ${n + 1}</strong><small>32 cores · 1 TB</small><div class="cores">${cc(c)}</div><small>CPU used by VM: ${c}</small>${bar(m)}<small>RAM used by VM: ${m} GB</small></div>`;
      el.querySelector('#nb').innerHTML = node(0, c0, m0) + node(1, c1, m1);
      el.querySelector('#nm').innerHTML = fits
        ? info('Fits in one NUMA node ✓', 'All of the VM\'s memory is local to its CPUs. This is the fast case. Smaller VMs are easier for ESXi to place.')
        : info('Spans both NUMA nodes ⚠', `This VM is bigger than one node (32 cores or 1 TB). Some of its memory access has to cross to the other socket, which is slower. ${v > 8 ? 'ESXi shows large VMs a virtual NUMA layout so NUMA-aware software can cope, but right-sizing is still the best fix.' : ''}`);
      el.querySelector('#nv').textContent = v; el.querySelector('#nr').textContent = r;
    };
    el.querySelector('#sv').oninput = (e) => { v = +e.target.value; draw(); };
    el.querySelector('#sr').oninput = (e) => { r = +e.target.value; draw(); };
    draw();
  };

  // ============================================================ 3. Cluster: HA, DRS, admission control
  VMW.WIDGET_TITLES.cluster = 'Cluster: fail a host, HA, DRS (interactive)';
  W.cluster = (el) => {
    const CAP = 10, N = 4;
    const st = { total: 24, ac: true, up: [true, true, true, true], n: [0, 0, 0, 0], lost: 0, msg: '' };
    const usable = () => (st.ac ? CAP * (N - 1) : CAP * N);
    const effective = () => Math.min(st.total, usable());
    const spreadUneven = (total) => {
      const w = [4, 3, 2, 1], out = [0, 0, 0, 0]; let left = total;
      for (let i = 0; i < N && left > 0; i++) { out[i] = Math.min(CAP, Math.round((total * w[i]) / 10)); left -= out[i]; }
      for (let i = 0; left > 0; i = (i + 1) % N) { if (out[i] < CAP) { out[i]++; left--; } }
      while (out.reduce((a, b) => a + b, 0) > total) { const k = out.indexOf(Math.max(...out)); out[k]--; }
      return out;
    };
    const reset = () => { st.up = [true, true, true, true]; st.lost = 0; st.n = spreadUneven(effective()); st.msg = 'Tap a host to make it fail, or press Balance (DRS).'; };
    const refused = () => st.total - effective();
    const balance = () => {
      const ups = st.up.map((u, i) => (u ? i : -1)).filter((i) => i >= 0), tot = st.n.reduce((a, b) => a + b, 0);
      ups.forEach((i, k) => { st.n[i] = Math.floor(tot / ups.length) + (k < tot % ups.length ? 1 : 0); });
      st.msg = 'DRS balanced the running VMs across the hosts that are up, using vMotion (no downtime).';
    };
    const fail = (i) => {
      if (!st.up[i]) return;
      const mv = st.n[i]; st.up[i] = false; st.n[i] = 0;
      const ups = st.up.map((u, k) => (u ? k : -1)).filter((k) => k >= 0);
      if (!ups.length) { st.lost += mv; st.msg = 'All hosts are down. Nothing can restart.'; return; }
      let ok = 0;
      for (let m = 0; m < mv; m++) {
        const k = ups.filter((x) => st.n[x] < CAP).sort((a, b) => st.n[a] - st.n[b])[0];
        if (k === undefined) break;
        st.n[k]++; ok++;
      }
      st.lost += mv - ok;
      st.msg = `Host ${i + 1} failed. HA restarted ${ok} of ${mv} VMs on the other hosts (a short outage while they boot).` + (mv - ok ? ` ${mv - ok} VMs could NOT restart: no spare capacity left. Admission control exists to prevent exactly this.` : ' There was enough spare capacity for all of them.');
    };
    el.innerHTML = frame('cluster', 'Cluster: HA, DRS and admission control', 'Four hosts, each able to run 10 VMs. Tap a host to fail it. Then try Balance, or change the load and admission control.', `
      <label class="w-range"><span>VMs in the cluster: <strong id="tn">${st.total}</strong></span><input type="range" id="tot" min="8" max="40" value="${st.total}"></label>
      <div id="dyn"></div>`);
    const dyn = el.querySelector('#dyn');
    const draw = () => {
      dyn.innerHTML = `
        <div class="hosts">${st.n.map((n, i) => `<button class="host ${st.up[i] ? '' : 'down'}" data-h="${i}" aria-label="Host ${i + 1}${st.up[i] ? ', tap to fail' : ', failed'}"><strong>Host ${i + 1}</strong><span class="dots">${Array.from({ length: CAP }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span><small>${st.up[i] ? `${n}/${CAP} VMs` : '✕ failed'}</small></button>`).join('')}</div>
        ${st.lost ? `<p class="w-alert">⚠ ${st.lost} VMs are down and could not be restarted.</p>` : ''}
        <div class="w-ctrl"><button class="btn ghost ${st.ac ? 'on' : ''}" id="ac">Admission control: ${st.ac ? 'ON (failover level 1)' : 'OFF'}</button><button class="btn ghost" id="bal">Balance (DRS)</button><button class="btn ghost" id="rst">Reset</button></div>
        ${refused() ? `<p class="w-note">Admission control is ON, so only ${usable()} VMs may run (one host's worth of room is kept free). ${refused()} VMs were refused at power-on.</p>` : ''}
        <div class="w-panel" aria-live="polite">${info('What happened', esc(st.msg))}</div>`;
      tap(dyn, '[data-h]', (b) => { fail(+b.dataset.h); draw(); });
      dyn.querySelector('#ac').onclick = () => { st.ac = !st.ac; reset(); st.msg = st.ac ? 'Admission control ON: the cluster keeps one host\'s worth of capacity free so HA can always restart VMs.' : 'Admission control OFF: you can fill every host. Try 40 VMs, then fail a host.'; draw(); };
      dyn.querySelector('#bal').onclick = () => { balance(); draw(); };
      dyn.querySelector('#rst').onclick = () => { reset(); draw(); };
    };
    el.querySelector('#tot').oninput = (e) => { st.total = +e.target.value; el.querySelector('#tn').textContent = st.total; reset(); draw(); };
    reset(); draw();
  };

  // ============================================================ 4. Storage chain with paths
  VMW.WIDGET_TITLES.storagechain = 'Storage chain and paths (tap, fail a path)';
  W.storagechain = (el) => {
    const INFO = {
      vm: ['Windows VM', 'Windows thinks it has a normal C: drive. It does not know about datastores or SANs.'],
      vmdk: ['VMDK file', 'The C: drive is really a file called something.vmdk. It lives in the VM\'s folder on a datastore.'],
      ds: ['Datastore (VMFS)', 'A shared file system on a LUN. Many hosts can use it at the same time. Yours: 307 VMFS datastores.'],
      hbaA: ['HBA A (host side)', 'A Fibre Channel card in the host. Each LUN is reached through at least two of these, for redundancy.'],
      hbaB: ['HBA B (host side)', 'The second card. If A fails, I/O flows through B.'],
      swA: ['FC switch A (the fabric)', 'The SAN switch. Fibre Channel runs in two separate fabrics so one switch failure cannot take everything down.'],
      swB: ['FC switch B', 'The second fabric.'],
      array: ['Storage array and LUN', 'Your Hitachi array holds the real disks and presents LUNs to the hosts. A LUN becomes a datastore.'],
    };
    const st = { a: true, b: true, sel: 'vm' };
    const draw = () => {
      const both = st.a && st.b, none = !st.a && !st.b;
      const msg = none ? ['All paths down ✕', 'The datastore is unreachable (APD, "all paths down"). VMs freeze and may crash. This is why LUNs have two or more independent paths.']
        : both ? ['Both paths active ✓', 'Round Robin alternates I/O between the two paths, using both and spreading the load.']
          : ['One path down ⚠', 'I/O carries on over the surviving path. Latency may rise a little because one path now carries all the load. Fix the failed part (cable, HBA, switch port, array port).'];
      const sel = (id) => (st.sel === id ? 'sel' : '');
      el.innerHTML = frame('storagechain', 'From the VM down to the disk', 'Tap any box to learn what it is. Use the buttons to break a path and see what still works.', `
        <svg viewBox="0 0 340 322" class="d-svg" role="group" aria-label="Storage chain">
          ${node('vm', 80, 6, 180, 34, 'Windows VM · C: drive', '', sel('vm'))}
          ${node('vmdk', 80, 54, 180, 34, 'VMDK file (virtual disk)', '', sel('vmdk'))}
          ${node('ds', 80, 102, 180, 34, 'Datastore (VMFS)', '', sel('ds'))}
          ${line('M170 40 V54')}${line('M170 88 V102')}
          ${line('M170 136 V148 H80 V160', st.a ? 'flow' : 'dead')}${line('M170 136 V148 H260 V160', st.b ? 'flow' : 'dead')}
          ${node('hbaA', 20, 160, 120, 32, 'HBA A', '', sel('hbaA') + (st.a ? '' : ' bad'))}${node('hbaB', 200, 160, 120, 32, 'HBA B', '', sel('hbaB') + (st.b ? '' : ' bad'))}
          ${line('M80 192 V206', st.a ? 'flow' : 'dead')}${line('M260 192 V206', st.b ? 'flow' : 'dead')}
          ${node('swA', 20, 206, 120, 32, 'FC switch A', '', sel('swA') + (st.a ? '' : ' bad'))}${node('swB', 200, 206, 120, 32, 'FC switch B', '', sel('swB') + (st.b ? '' : ' bad'))}
          ${line('M80 238 V254', st.a ? 'flow' : 'dead')}${line('M260 238 V254', st.b ? 'flow' : 'dead')}
          ${node('array', 20, 254, 300, 56, 'Hitachi array', 'LUN → becomes the datastore', sel('array'))}
          ${st.a ? '' : '<text x="132" y="181" class="d-x" text-anchor="end">✕</text>'}${st.b ? '' : '<text x="312" y="181" class="d-x" text-anchor="end">✕</text>'}
        </svg>
        <div class="w-ctrl"><button class="btn ghost ${st.a ? '' : 'on'}" id="fa">${st.a ? 'Fail path A' : 'Restore path A'}</button><button class="btn ghost ${st.b ? '' : 'on'}" id="fb">${st.b ? 'Fail path B' : 'Restore path B'}</button></div>
        <div class="w-panel" aria-live="polite">${info(...msg)}${info(...INFO[st.sel])}</div>`);
      tap(el, '[data-p]', (g) => { st.sel = g.dataset.p; draw(); });
      el.querySelector('#fa').onclick = () => { st.a = !st.a; draw(); };
      el.querySelector('#fb').onclick = () => { st.b = !st.b; draw(); };
    };
    draw();
  };

  // ============================================================ 5. Datastore fill (thin vs thick, snapshots)
  VMW.WIDGET_TITLES.datastore = 'Datastore space: thin, thick and snapshots (sliders)';
  W.datastore = (el) => {
    const CAPT = 10;
    const s = { thick: 3, thin: 6, use: 40, snap: 0.5 };
    el.innerHTML = frame('datastore', 'Will this datastore fill up?', 'A 10 TiB datastore. Move the sliders to see used space, over-commitment and the alarm levels.', `
      <label class="w-range"><span>Thick-provisioned VMs: <strong id="a1"></strong> TiB</span><input type="range" id="r1" min="0" max="8" step="0.5" value="${s.thick}"></label>
      <label class="w-range"><span>Thin VMs, provisioned size: <strong id="a2"></strong> TiB</span><input type="range" id="r2" min="0" max="20" step="0.5" value="${s.thin}"></label>
      <label class="w-range"><span>…of which actually written: <strong id="a3"></strong>%</span><input type="range" id="r3" min="5" max="100" step="5" value="${s.use}"></label>
      <label class="w-range"><span>Snapshots: <strong id="a4"></strong> TiB</span><input type="range" id="r4" min="0" max="4" step="0.25" value="${s.snap}"></label>
      <div class="ds"><div class="ds-used" id="du"></div><div class="ds-mark m80"></div><div class="ds-mark m90"></div></div>
      <p class="w-hint ds-lab"><span>0</span><span>80%</span><span>90%</span><span>100%</span></p>
      <div class="w-panel" id="dm" aria-live="polite"></div>`);
    const draw = () => {
      const used = s.thick + (s.thin * s.use) / 100 + s.snap, prov = s.thick + s.thin + s.snap, pct = (100 * used) / CAPT, over = prov / CAPT;
      const col = pct >= 100 ? 'bad' : pct >= 90 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
      const u = el.querySelector('#du'); u.style.width = Math.min(100, pct) + '%'; u.className = 'ds-used ' + col; u.textContent = Math.round(pct) + '% used';
      el.querySelector('#a1').textContent = s.thick; el.querySelector('#a2').textContent = s.thin; el.querySelector('#a3').textContent = s.use; el.querySelector('#a4').textContent = s.snap;
      const head = pct >= 100 ? 'Datastore FULL ✕' : pct >= 90 ? 'Critical: above 90% ⚠' : pct >= 80 ? 'Warning: above 80%' : 'Healthy ✓';
      const body = pct >= 100 ? 'Thin disks cannot grow and snapshots cannot write, so VMs pause or crash. Free space now: delete snapshots with the owner\'s OK, or Storage vMotion a VM away.'
        : pct >= 90 ? 'Act today. Find the biggest consumers (snapshots, thin growth, big or powered-off VMs) and free or move space.'
          : pct >= 80 ? 'Raise it with the owners and plan a move or more capacity.' : 'Plenty of room right now.';
      el.querySelector('#dm').innerHTML = info(head, `${used.toFixed(2)} of ${CAPT} TiB used. ${body}`) + info(over > 1 ? `Over-committed ${over.toFixed(2)}× ⚠` : `Provisioned ${(over * 100).toFixed(0)}% of capacity`, over > 1 ? 'Thin disks promise more space than exists. It is fine only while the data written stays below capacity, so you must watch free space.' : 'Provisioned space fits inside the datastore.');
    };
    [['r1', 'thick'], ['r2', 'thin'], ['r3', 'use'], ['r4', 'snap']].forEach(([id, k]) => { el.querySelector('#' + id).oninput = (e) => { s[k] = +e.target.value; draw(); }; });
    draw();
  };

  // ============================================================ 6. Networking path
  VMW.WIDGET_TITLES.network = 'Network path: uplinks and port groups (interactive)';
  W.network = (el) => {
    const INFO = {
      vm1: ['VM on host A', 'The VM\'s virtual NIC (VMXNET3) connects to a port group, not directly to the switch.'],
      vm2: ['VM after vMotion to host B', 'It moved to another host and must find the SAME port group and VLAN there.'],
      pg: ['Port group (VLAN 20)', 'A named network on the switch. It tags traffic with VLAN 20. If a host has no matching port group, VMs moved there lose the network.'],
      vs: ['Virtual switch', 'Standard vSwitch (per host) or distributed switch (one config for many hosts). It connects port groups to uplinks.'],
      n0: ['vmnic0 (uplink)', 'A physical NIC port on the host. Two or more in a team give redundancy and bandwidth.'],
      n1: ['vmnic1 (uplink)', 'The second uplink of the team.'],
      sw: ['Physical switch trunk port', 'The physical switch port is a trunk that carries many VLANs, including VLAN 20.'],
    };
    const st = { n0: true, n1: true, pgOK: true, sel: 'pg' };
    const draw = () => {
      const up = st.n0 || st.n1;
      const msg = !up ? ['No uplinks ✕', 'The switch has no way out. Every VM on it, and the host\'s own management traffic, is cut off.']
        : !st.pgOK ? ['VM lost its network ⚠', 'The port group (or VLAN) does not exist on host B. This is the classic problem with standard vSwitches. A distributed switch avoids it.']
          : (st.n0 && st.n1) ? ['Healthy ✓', 'Traffic uses both uplinks and survives a cable or NIC failure.'] : ['One uplink down ⚠', 'Teaming keeps the VMs online on the other uplink, with half the bandwidth.'];
      const s = (id) => (st.sel === id ? 'sel' : '');
      el.innerHTML = frame('network', 'From the VM to the physical switch', 'Tap a box to learn about it. Break an uplink, or move the VM to a host without the port group.', `
        <svg viewBox="0 0 340 292" class="d-svg" role="group" aria-label="Network path">
          ${node('vm1', 20, 6, 130, 32, 'VM (host A)', '', s('vm1'))}${node('vm2', 190, 6, 130, 32, 'VM (host B)', '', s('vm2') + (st.pgOK ? '' : ' bad'))}
          ${line('M85 38 V60', 'flow')}${line('M255 38 V60', st.pgOK && up ? 'flow' : 'dead')}
          ${node('pg', 20, 60, 300, 30, 'Port group · VLAN 20', '', s('pg'))}
          ${line('M170 90 V112', up ? 'flow' : 'dead')}
          ${node('vs', 20, 112, 300, 30, 'Virtual switch (vSwitch / dvSwitch)', '', s('vs'))}
          ${line('M95 142 V170', st.n0 ? 'flow' : 'dead')}${line('M245 142 V170', st.n1 ? 'flow' : 'dead')}
          ${node('n0', 40, 170, 110, 30, 'vmnic0', '', s('n0') + (st.n0 ? '' : ' bad'))}${node('n1', 190, 170, 110, 30, 'vmnic1', '', s('n1') + (st.n1 ? '' : ' bad'))}
          ${line('M95 200 V232', st.n0 ? 'flow' : 'dead')}${line('M245 200 V232', st.n1 ? 'flow' : 'dead')}
          ${node('sw', 20, 232, 300, 44, 'Physical switch', 'trunk port: VLANs 10, 20, 30', s('sw'))}
          ${st.n0 ? '' : '<text x="142" y="191" class="d-x" text-anchor="end">✕</text>'}${st.n1 ? '' : '<text x="292" y="191" class="d-x" text-anchor="end">✕</text>'}
          ${st.pgOK ? '' : '<text x="255" y="54" class="d-x" text-anchor="middle">✕</text>'}
        </svg>
        <div class="w-ctrl"><button class="btn ghost ${st.n0 ? '' : 'on'}" id="n0">${st.n0 ? 'Fail vmnic0' : 'Restore vmnic0'}</button><button class="btn ghost ${st.n1 ? '' : 'on'}" id="n1">${st.n1 ? 'Fail vmnic1' : 'Restore vmnic1'}</button><button class="btn ghost ${st.pgOK ? '' : 'on'}" id="pg">${st.pgOK ? 'Remove port group on host B' : 'Add port group on host B'}</button></div>
        <div class="w-panel" aria-live="polite">${info(...msg)}${info(...INFO[st.sel])}</div>`);
      tap(el, '[data-p]', (g) => { st.sel = g.dataset.p; draw(); });
      ['n0', 'n1'].forEach((k) => { el.querySelector('#' + k).onclick = () => { st[k] = !st[k]; draw(); }; });
      el.querySelector('#pg').onclick = () => { st.pgOK = !st.pgOK; draw(); };
    };
    draw();
  };

  // ============================================================ 7. VM files
  VMW.WIDGET_TITLES.vmfiles = 'A VM is a folder of files (tap a file)';
  W.vmfiles = (el) => {
    const F = [
      ['web01.vmx', 'Configuration', 'The VM\'s settings: CPU, RAM, disks, NICs. A small text file.'],
      ['web01.vmdk', 'Disk descriptor', 'A tiny text file that points to the real data file. This is what you "see" as the disk.'],
      ['web01-flat.vmdk', 'Disk data', 'The actual data of the virtual disk. Size = provisioned size (thick) or what has been written (thin).'],
      ['web01-000001-delta.vmdk', 'Snapshot delta', 'Created by a snapshot. New writes go here, and it keeps growing until the snapshot is deleted.'],
      ['web01-1a2b3c.vswp', 'Swap file', 'Same size as the VM\'s RAM minus any reservation. A 32 GB VM with no reservation has a 32 GB swap file on the datastore.'],
      ['web01.nvram', 'BIOS / UEFI settings', 'Stores the VM\'s firmware settings. Small.'],
      ['web01.vmsd', 'Snapshot list', 'Keeps track of the VM\'s snapshots.'],
      ['vmware.log', 'Log', 'Troubleshooting log for the VM. Helpful when a VM will not power on.'],
    ];
    el.innerHTML = frame('vmfiles', 'Inside the VM\'s folder on the datastore', 'Tap a file to see what it is for.', `<div class="files">${F.map((f, i) => `<button class="file" data-i="${i}"><code>${esc(f[0])}</code><small>${esc(f[1])}</small></button>`).join('')}</div><div class="w-panel" aria-live="polite">${info('Tap a file', 'Start with the -flat.vmdk and the .vswp.')}</div>`);
    tap(el, '[data-i]', (b) => { $$('.file', el).forEach((x) => x.classList.toggle('sel', x === b)); const f = F[+b.dataset.i]; el.querySelector('.w-panel').innerHTML = info(`${f[0]}: ${f[1]}`, esc(f[2])); });
  };

  // ============================================================ 8. Snapshot growth
  VMW.WIDGET_TITLES.snapshot = 'Why old snapshots hurt (slider)';
  W.snapshot = (el) => {
    const DISK = 200; let days = 3, rate = 2;
    el.innerHTML = frame('snapshot', 'How a snapshot grows', 'A 200 GB disk with a snapshot. Drag the age, or tap a preset. The numbers are illustrative.', `
      <label class="w-range"><span>Snapshot age: <strong id="sa"></strong> days</span><input type="range" id="sd" min="0" max="1300" value="${days}"></label>
      <div class="w-ctrl"><button class="btn ghost" data-d="1">1 day</button><button class="btn ghost" data-d="7">1 week</button><button class="btn ghost" data-d="90">3 months</button><button class="btn ghost" data-d="1270">May 2023 one</button></div>
      <label class="w-range"><span>How much the VM writes: <strong id="sr"></strong></span><select id="sc"><option value="0.5">Light (0.5 GB/day)</option><option value="2" selected>Normal (2 GB/day)</option><option value="6">Busy (6 GB/day)</option></select></label>
      <div class="snap"><div class="snap-base">Base disk<br>${DISK} GB</div><div class="snap-delta" id="sx"></div></div>
      <div class="w-panel" id="sm" aria-live="polite"></div>`);
    const draw = () => {
      const delta = Math.min(DISK, +(days * rate).toFixed(1)), mins = Math.max(1, Math.round((delta * 1024) / 100 / 60));
      const lvl = days <= 1 ? ['Fine ✓', 'Snapshots are meant for hours or a day or two, for example before a patch.'] : days <= 7 ? ['Getting old', 'Delete it once the change is confirmed.'] : days <= 90 ? ['Risky ⚠', 'Reads now go through the delta chain, so disk I/O is slower. Backups may be slower too.'] : ['Dangerous ✕', 'The delta can be as large as the base disk. Deleting it takes a long time and needs free datastore space, and the VM can stun while it consolidates.'];
      el.querySelector('#sa').textContent = days; el.querySelector('#sr').textContent = rate + ' GB/day';
      const x = el.querySelector('#sx'); x.style.width = Math.max(4, (100 * delta) / DISK) + '%'; x.innerHTML = `Delta<br>${delta} GB`;
      el.querySelector('#sm').innerHTML = info(lvl[0], `${lvl[1]} Estimated time to delete and consolidate: about ${mins} min (at ~100 MB/s).`) + info('A snapshot is not a backup', 'It lives on the same datastore as the VM. If the datastore is lost, both are lost.');
    };
    el.querySelector('#sd').oninput = (e) => { days = +e.target.value; draw(); };
    el.querySelector('#sc').onchange = (e) => { rate = +e.target.value; draw(); };
    tap(el, '[data-d]', (b) => { days = +b.dataset.d; el.querySelector('#sd').value = days; draw(); });
    draw();
  };

  // ============================================================ 9. Troubleshooting decision tree
  VMW.WIDGET_TITLES.flow = 'Troubleshooting: "the VM is slow" (tap through)';
  W.flow = (el) => {
    const T = {
      s: { q: 'Users say a VM is slow. Is it only one VM, or many?', o: [['Only one VM', 'a'], ['Many VMs', 'b']] },
      a: { q: 'Inside Windows or Linux: is the guest itself busy (CPU, memory or disk in Task Manager / top)?', o: [['Yes, something is busy', 'a1'], ['No, it looks idle', 'a2']] },
      a1: { end: 'Look at the application or OS', t: 'Find the process using the resource. Check recent patches, antivirus scans and application changes. It may not be a VMware problem.' },
      a2: { q: 'In vCenter: is CPU Ready above about 5% per vCPU?', o: [['Yes', 'a3'], ['No', 'a4']] },
      a3: { end: 'CPU contention', t: 'The VM waits for physical cores. Reduce its vCPUs, check how many vCPUs the host runs overall, and let DRS rebalance. Verify with esxtop (%RDY, %CSTP).' },
      a4: { q: 'Is disk latency high (over about 20 to 30 ms), or is there a snapshot on the VM?', o: [['Yes', 'a5'], ['No', 'a6']] },
      a5: { end: 'Storage or snapshot', t: 'Delete or consolidate old snapshots (with the owner\'s OK). Check DAVG vs KAVG on the datastore, look for a noisy neighbour, and check paths.' },
      a6: { end: 'Memory, limits or network', t: 'Check ballooning and swapping, any memory or CPU limit on the VM, and network drops. Then look again at what changed recently.' },
      b: { q: 'Do the slow VMs share the same host?', o: [['Yes', 'b1'], ['No', 'b2']] },
      b1: { end: 'Suspect the host', t: 'Check host CPU Ready and memory ballooning, hardware errors in iLO/iDRAC, and whether DRS is working. Move a VM away with vMotion to test.' },
      b2: { q: 'Do they share the same datastore?', o: [['Yes', 'b3'], ['No', 'b4']] },
      b3: { end: 'Suspect storage', t: 'Check datastore latency, queueing (KAVG), failed paths, a noisy VM, backups running, and the array\'s load with the storage team.' },
      b4: { end: 'Suspect something shared', t: 'DNS, Active Directory, a network link, backups, vCenter or a recent change. Ask what changed and when it started.' },
    };
    const trail = ['s'];
    const draw = () => {
      const cur = T[trail[trail.length - 1]];
      el.innerHTML = frame('flow', 'Where do I look first?', 'Answer each question. You will end up at the most likely place to look.', `
        <div class="crumbs">${trail.map((k, i) => (T[k].q ? `<span>${i + 1}</span>` : '')).join('')}</div>
        ${cur.q ? `<p class="flow-q">${esc(cur.q)}</p><div class="flow-o">${cur.o.map(([l, n]) => `<button class="btn" data-n="${n}">${esc(l)}</button>`).join('')}</div>`
          : `<div class="flow-end">${info('→ ' + cur.end, esc(cur.t))}</div>`}
        <div class="w-ctrl">${trail.length > 1 ? '<button class="btn ghost" id="bk">← Back</button>' : ''}${trail.length > 1 ? '<button class="btn ghost" id="rs">Start again</button>' : ''}</div>`);
      tap(el, '[data-n]', (b) => { trail.push(b.dataset.n); draw(); });
      const bk = el.querySelector('#bk'); if (bk) bk.onclick = () => { trail.pop(); draw(); };
      const rs = el.querySelector('#rs'); if (rs) rs.onclick = () => { trail.length = 1; draw(); };
    };
    draw();
  };

  // ============================================================ 10. CPU ready / over-commit
  VMW.WIDGET_TITLES.cpuready = 'CPU Ready: too many vCPUs? (sliders)';
  W.cpuready = (el) => {
    const CORES = 16; let vms = 6, vcpu = 4;
    el.innerHTML = frame('cpuready', 'Cores vs vCPUs on one host', 'A host with 16 physical cores. Add VMs and change their size. This is a rule of thumb, not an exact measurement.', `
      <label class="w-range"><span>Number of VMs: <strong id="cv"></strong></span><input type="range" id="c1" min="1" max="24" value="${vms}"></label>
      <label class="w-range"><span>vCPUs per VM: <strong id="cc"></strong></span><input type="range" id="c2" min="1" max="16" value="${vcpu}"></label>
      <div class="w-ctrl"><button class="btn ghost" id="rs">Right-size: 16 → 4 vCPU</button></div>
      <div class="cpu"><div class="cpu-row"><small>Physical cores</small><div class="cpu-cells" id="p"></div></div><div class="cpu-row"><small>vCPUs wanting to run</small><div class="cpu-cells" id="q"></div></div></div>
      <div class="w-panel" id="cm" aria-live="polite"></div>`);
    const draw = () => {
      const tot = vms * vcpu, ratio = tot / CORES;
      el.querySelector('#cv').textContent = vms; el.querySelector('#cc').textContent = vcpu;
      el.querySelector('#p').innerHTML = Array.from({ length: CORES }, () => '<i class="core"></i>').join('');
      const shown = Math.min(tot, 96);
      el.querySelector('#q').innerHTML = Array.from({ length: shown }, (_, i) => `<i class="${i < CORES ? 'v ok' : 'v wait'}"></i>`).join('') + (tot > shown ? `<small>+${tot - shown}</small>` : '');
      const [h, b] = ratio <= 1 ? ['No contention ✓', 'Every vCPU can have a core. CPU Ready should be near zero.']
        : ratio <= 3 ? ['Normal over-commit ✓', 'Not every VM is busy at the same time, so sharing is fine here. Keep watching CPU Ready.']
          : ratio <= 5 ? ['Getting tight ⚠', 'At busy times VMs wait for a core. Check CPU Ready (aim to stay under about 5% per vCPU).']
            : ['Heavy contention ✕', 'Many vCPUs are waiting. Expect high CPU Ready and slow VMs even though CPU usage inside the VMs may look low.'];
      const big = vcpu > 8 && vms * vcpu > CORES ? info('Big VMs make it worse', 'A VM with many vCPUs needs many cores free at once, so it waits longer than a small one. Right-sizing is the first fix.') : '';
      el.querySelector('#cm').innerHTML = info(h, `${tot} vCPUs on ${CORES} cores = ${ratio.toFixed(1)} vCPUs per core. ${b}`) + big;
    };
    el.querySelector('#c1').oninput = (e) => { vms = +e.target.value; draw(); };
    el.querySelector('#c2').oninput = (e) => { vcpu = +e.target.value; el.querySelector('#c2').value = vcpu; draw(); };
    el.querySelector('#rs').onclick = () => { vcpu = 4; el.querySelector('#c2').value = 4; draw(); };
    draw();
  };

  // ============================================================ 11. Environment map
  VMW.WIDGET_TITLES.envmap = 'Your clusters (tap a block)';
  W.envmap = (el) => {
    const E = VMW.ENV;
    const flag = (c) => /off|warn/i.test(c.note);
    el.innerHTML = frame('envmap', 'Your 9 clusters at a glance', 'Each block is a cluster, sized by the number of hosts. Orange blocks have something to talk about. Tap one.', `
      <div class="tiles">${E.clusters.map((c, i) => `<button class="tile ${flag(c) ? 'flag' : ''}" style="flex:${c.hosts} 1 ${Math.max(78, c.hosts * 22)}px" data-i="${i}"><strong>${esc(c.name)}</strong><small>${c.hosts} hosts</small></button>`).join('')}</div>
      <div class="w-panel" aria-live="polite">${info('Tap a cluster', 'HA and DRS are on in all 9 clusters, with failover level 1.')}</div>`);
    const TIPS = {
      'Internal': 'Admission control is OFF here. After a host failure HA may not have room to restart everything. A good thing to mention and to review.',
      'GPU': 'HA warnings: the isolation address is unreachable and there are too few heartbeat datastores. GPU passthrough VMs usually cannot be vMotioned, so they are harder to move around.',
      'SQL': 'Database VMs. Storage latency matters most here, and SQL licensing is often tied to the cores in use.',
      'Linux workloads': 'The largest cluster: 13 hosts. Linux is 645 of your 1,185 VMs.',
      'External-facing': 'External-facing workloads. Typically stricter on patching and network design.',
    };
    tap(el, '[data-i]', (b) => { $$('.tile', el).forEach((x) => x.classList.toggle('sel', x === b)); const c = E.clusters[+b.dataset.i]; el.querySelector('.w-panel').innerHTML = info(`${c.name} · ${c.hosts} hosts`, esc(TIPS[c.name] || c.note || (c.hosts === 2 ? 'A 2-host cluster at failover level 1: each host must be able to carry the whole cluster, so only about half the capacity is safely usable.' : 'HA and DRS are on.'))); });
  };
})();
