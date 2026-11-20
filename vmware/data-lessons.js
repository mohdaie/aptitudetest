// VMware prep: environment facts and lessons.
// Cluster and host names are generalised on purpose (this repo is public): no hostnames, IPs or company names.
window.VMW = window.VMW || {};

VMW.ENV = {
  vcenter: 'vCenter 8.0.3',
  esxi: 'ESXi 8.0.3 (47 of 50 hosts on the same build)',
  hosts: 50,
  clusters: [
    { name: 'Linux workloads', hosts: 13, note: 'Largest cluster' },
    { name: 'Internal QA', hosts: 8, note: '' },
    { name: 'Internal', hosts: 7, note: 'Admission control is OFF' },
    { name: 'External-facing', hosts: 5, note: '' },
    { name: 'SQL', hosts: 4, note: 'Database VMs' },
    { name: 'GPU', hosts: 4, note: 'HA warnings: isolation address, heartbeat datastores' },
    { name: 'Management', hosts: 2, note: '2-host cluster' },
    { name: 'Non-production', hosts: 2, note: '2-host cluster' },
    { name: 'Production (app group)', hosts: 2, note: '2-host cluster' },
  ],
  hardware: [
    { n: 11, model: 'HPE DL380 Gen11', cpu: 'Xeon Gold 6448Y', cores: 64, ram: '~2 TB' },
    { n: 10, model: 'HPE DL380 Gen11', cpu: 'Xeon Gold 6430', cores: 64, ram: '1 TB (4 hosts 2 TB)' },
    { n: 5, model: 'HPE DL380 Gen10', cpu: 'Xeon Platinum 8260', cores: 48, ram: '~2 TB' },
    { n: 6, model: 'HPE DL380 Gen10 Plus', cpu: 'Xeon Silver 4316', cores: 40, ram: '~1.5 TB' },
    { n: 7, model: 'Dell R640', cpu: 'Xeon Platinum 8170', cores: 52, ram: '1 TB' },
    { n: 4, model: 'Dell R640', cpu: 'Xeon Gold 6154', cores: 36, ram: '1 TB' },
    { n: 4, model: 'Dell R740', cpu: 'Xeon Platinum 8170', cores: 52, ram: '1 TB' },
    { n: 3, model: 'Cisco BE7M-M5-K9', cpu: 'Xeon Gold 6132', cores: 14, ram: '~96 GB' },
  ],
  vms: { total: 1185, on: 1041, off: 144, templates: 32, linux: 645, windows: 498 },
  storage: { datastores: 307, type: 'VMFS on Hitachi FC SAN', tib: 1433, free: '64%', vmfs6: 269, vmfs5: 38, empty: 106, lowest: '18% free', paths: '2 per LUN, Round Robin', hba: '16 Gb and 32 Gb FC (QLogic, Emulex, Marvell)' },
  network: { speed: '10GbE on 46 of 50 hosts', dvs: 14, vss: '19 hosts also have a standard vSwitch0', vmk: 'vmk0 (management) on every host' },
  housekeeping: { snapshots: 79, snapVMs: 76, oldest: '29 May 2023', toolsUpgradable: 477, zombies: 1166, cdrom: 45, ntp: 3, vcpuPerCore: 12 },
};

// A one-paragraph description of the environment, used by the AI coach.
VMW.ENV_SUMMARY = `The learner works in a vSphere estate with: vCenter 8.0.3; 50 ESXi 8.0.3 hosts (HPE DL380 Gen10/Gen10 Plus/Gen11, Dell R640/R740, and 3 spare Cisco hosts) in 9 clusters (Linux 13 hosts, Internal QA 8, Internal 7 with admission control off, External 5, SQL 4, GPU 4 with HA warnings, and three 2-host clusters: Management, Non-prod, Production). HA and DRS are on everywhere; failover level 1. About 1,185 VMs (1,041 on; 645 Linux, 498 Windows Server; 32 templates). Storage: 307 VMFS datastores (269 VMFS6, 38 VMFS5) on a Hitachi Fibre Channel SAN, 1,433 TiB total with 64% free, 2 paths per LUN with Round Robin, 16/32 Gb HBAs. Network: mostly 10GbE, 14 distributed switches, 19 hosts also have a standard vSwitch0, vmk0 only (vMotion likely shares management, to be confirmed). Housekeeping findings: 79 snapshots on 76 VMs (oldest May 2023), 477 VMs with upgradable VMware Tools, 1,166 possible zombie vmdk warnings, 45 VMs with CD-ROM connected, 3 hosts with NTP problems, 106 empty datastores. The learner is a Windows/infrastructure admin who is new to deep VMware, storage and hardware, preparing for a technical interview with a VMware/Windows/x86 performance specialist.`;

VMW.MODULES = [
  { id: 'm1', icon: '🖥', title: 'Hardware', blurb: 'Servers, CPUs, RAM, NUMA, iLO/iDRAC, HBAs and NICs' },
  { id: 'm2', icon: '🧩', title: 'vSphere and clusters', blurb: 'ESXi, vCenter, HA, DRS, vMotion, admission control' },
  { id: 'm3', icon: '💾', title: 'Storage', blurb: 'SAN, LUNs, VMFS, multipathing, thin/thick, Storage vMotion' },
  { id: 'm4', icon: '🌐', title: 'Networking', blurb: 'vSwitch, dvSwitch, port groups, VMkernel, VLANs, uplinks' },
  { id: 'm5', icon: '📦', title: 'VMs and housekeeping', blurb: 'vmdk, snapshots, Tools, templates, zombie files' },
  { id: 'm6', icon: '🔍', title: 'Performance and troubleshooting', blurb: 'CPU Ready, ballooning, latency, esxtop, a method' },
  { id: 'm7', icon: '🏢', title: 'My environment', blurb: 'Numbers and facts from your own estate' },
];

// Lessons are HTML. Each has: sections with a title and html, a "yours" box (your environment) and key terms.
VMW.LESSONS = {
  m1: {
    intro: 'Every VM you manage is really a process on a physical server. Know the server and you can explain most performance questions.',
    sections: [
      { t: 'Inside a server', h: `<p>A host is a normal x86 server with five parts that matter:</p>
<ul><li><strong>CPU sockets:</strong> physical chips. Yours are 2-socket servers.</li>
<li><strong>Cores:</strong> processing units inside each socket. A 2 × 32 server has <strong>64 cores</strong>. With hyper-threading each core shows two logical threads.</li>
<li><strong>RAM:</strong> split between the sockets. Each socket's share is a <strong>NUMA node</strong>.</li>
<li><strong>HBA:</strong> a card that talks to the Fibre Channel SAN (storage).</li>
<li><strong>NIC:</strong> a card that talks to the network.</li></ul>` },
      { t: 'NUMA in plain words', h: `<p>Memory attached to a CPU is fast for that CPU and slower for the other one. A VM that fits inside <strong>one NUMA node</strong> (its vCPUs and RAM fit within one socket's share) gets fast, local memory.</p>
<p>Example: a host with 2 sockets × 32 cores and 2 TB RAM has two nodes of 32 cores and 1 TB each. A VM with 64 vCPUs or 768 GB+ must span both nodes. Spanning is allowed, but memory access can be slower.</p>
<p class="tip"><strong>Rule of thumb:</strong> size VMs as small as the workload allows. Bigger is not faster.</p>` },
      { t: 'Out-of-band management', h: `<p><strong>HPE iLO</strong> and <strong>Dell iDRAC</strong> are a small separate computer inside the server with its own network port. Even when ESXi is dead or the server is off, you can still: see hardware health (fans, disks, PSUs, memory errors), power on/off, open a remote console and mount an ISO.</p>` },
      { t: 'CPU generations and EVC', h: `<p>Newer CPUs (for example Gen11 Sapphire Rapids) have newer instruction sets than older ones (Skylake in R640/R740). A running VM cannot move live between very different CPU types unless the cluster uses <strong>EVC (Enhanced vMotion Compatibility)</strong>, which hides the newer features so all hosts look the same.</p>` },
      { t: 'Resilience features', h: `<ul><li><strong>Redundant power supplies</strong> on two circuits.</li><li><strong>ECC RAM</strong> corrects single-bit errors.</li><li><strong>RAID controller</strong> for the local boot disks (the "Local" adapters you see in RVTools).</li><li><strong>Hot-swap</strong> disks and fans.</li></ul>` },
    ],
    yours: `Your 50 hosts are mostly HPE DL380 (Gen10, Gen10 Plus, Gen11) and Dell R640/R740, all 2-socket, with 36 to 64 cores and 1 to 2 TB RAM. Three small Cisco hosts have no VMs. Check one host's Summary tab in vCenter and find: model, CPU, number of cores, RAM, ESXi version.`,
    terms: [['Socket', 'A physical CPU chip'], ['Core', 'A processing unit inside a CPU'], ['vCPU', 'A virtual CPU given to a VM'], ['NUMA node', 'A CPU plus its local memory'], ['iLO / iDRAC', 'Remote management chip (HPE / Dell)'], ['HBA', 'Fibre Channel card to the SAN'], ['EVC', 'Makes different CPU generations vMotion-compatible']],
  },
  m2: {
    intro: 'vSphere is two products: ESXi on every server, and vCenter above them. Clusters give you the features that matter: vMotion, DRS and HA.',
    sections: [
      { t: 'ESXi and vCenter', h: `<p><strong>ESXi</strong> is the hypervisor: a small operating system installed on each server that runs VMs. You can manage one host alone through its own web page.</p><p><strong>vCenter</strong> is a management server that connects to many ESXi hosts. It unlocks cluster features and gives one place to manage everything. If vCenter is down, VMs keep running, but you lose central management, DRS and vMotion.</p>` },
      { t: 'Objects and hierarchy', h: `<p>vCenter organises things as: <strong>Datacenter → Cluster → Host → VM</strong>, plus datastores, networks and folders. A <strong>cluster</strong> pools the CPU and RAM of its hosts.</p>` },
      { t: 'vMotion', h: `<p>Moves a running VM from one host to another with no downtime. Needs: shared storage (or Storage vMotion), a vMotion network, and compatible CPUs. Blockers: a connected CD-ROM/ISO on local storage, passthrough devices (e.g. GPU), CPU incompatibility, or different networks on the two hosts.</p>` },
      { t: 'DRS', h: `<p>Watches host load and uses vMotion to balance VMs across hosts. It also picks the best host when a VM powers on. Levels: manual, partially automated, fully automated. It can also use <strong>affinity rules</strong> (keep VMs together or apart).</p>` },
      { t: 'HA', h: `<p>If a host fails, HA restarts its VMs on the other hosts. This is a <strong>restart</strong> (short outage), not zero downtime. HA decides a host has failed using network heartbeats and <strong>heartbeat datastores</strong>. The <strong>isolation address</strong> is an IP the host pings to check if it has lost the network or the whole network is down.</p>` },
      { t: 'Admission control', h: `<p>Reserves spare capacity so that HA can really restart VMs after a failure. "Failover level 1" means the cluster keeps room for one host to fail. If admission control is off, HA still restarts what it can, but there may not be enough capacity for everything.</p><p class="tip">A 2-host cluster at failover level 1 means each host must be able to carry the whole cluster, so only about 50% of capacity is usable.</p>` },
    ],
    yours: `vCenter 8.0.3 manages 50 hosts in 9 clusters. HA and DRS are on in all of them. Admission control is off in the Internal cluster. The GPU cluster shows HA warnings about the isolation address and heartbeat datastores. Open Cluster > Configure > vSphere Availability to see each setting.`,
    terms: [['Cluster', 'A group of hosts managed as one pool'], ['vMotion', 'Live move of a VM between hosts'], ['DRS', 'Automatic load balancing'], ['HA', 'Restarts VMs after a host failure'], ['Admission control', 'Keeps spare capacity for HA'], ['Isolation address', 'IP a host pings to detect isolation'], ['EVC', 'CPU compatibility mode']],
  },
  m3: {
    intro: 'Storage causes the most confusing problems. Learn the chain from the VM down to the array and you can follow any storage problem.',
    sections: [
      { t: 'The chain', h: `<ol><li>Windows sees a <strong>C: drive</strong>.</li><li>That is a <strong>.vmdk</strong> file (virtual disk).</li><li>It lives on a <strong>datastore</strong> (a VMFS file system).</li><li>The datastore sits on a <strong>LUN</strong>, a slice of storage presented by the array.</li><li>The LUN is reached through the <strong>HBA</strong> and the <strong>Fibre Channel fabric</strong>.</li><li>The <strong>storage array</strong> (Hitachi) holds the real disks (RAID, flash).</li></ol>` },
      { t: 'SAN, NAS, vSAN', h: `<ul><li><strong>SAN (block):</strong> hosts see raw disks (LUNs) over Fibre Channel or iSCSI. ESXi puts VMFS on them. This is your setup.</li><li><strong>NAS (file):</strong> hosts mount an NFS share.</li><li><strong>vSAN:</strong> VMware builds shared storage from the local disks of the hosts.</li></ul>` },
      { t: 'VMFS', h: `<p>The VMware file system designed so many hosts can use the same LUN at the same time. Versions: <strong>VMFS 5</strong> (older) and <strong>VMFS 6</strong> (newer, automatic space reclamation). There is <strong>no in-place upgrade</strong> from 5 to 6: create a new datastore and Storage vMotion the VMs over.</p>` },
      { t: 'Multipathing', h: `<p>Each LUN is reachable over several <strong>paths</strong> (HBA port → switch → array port). If one path fails, I/O continues on another. The <strong>path selection policy</strong> decides how paths are used: <strong>Round Robin</strong> alternates between active paths (common with active/active arrays like Hitachi), <strong>Fixed</strong> uses one preferred path, <strong>MRU</strong> uses the last working path.</p>` },
      { t: 'Provisioning and space', h: `<ul><li><strong>Thin:</strong> uses space only as data is written. Saves space, but datastores can be over-committed and fill up.</li><li><strong>Thick lazy zeroed / eager zeroed:</strong> reserves the full size up front.</li><li><strong>Space reclamation (UNMAP):</strong> returns deleted space to the array. Automatic on VMFS 6.</li></ul><p><strong>Storage vMotion</strong> moves a running VM's disks to another datastore.</p>` },
      { t: 'Latency, IOPS, throughput', h: `<ul><li><strong>IOPS:</strong> operations per second. Important for databases and many small reads/writes.</li><li><strong>Throughput:</strong> MB/s. Important for backups and large files.</li><li><strong>Latency:</strong> time per operation. Under ~20 ms is generally fine, over ~30 ms is a problem.</li></ul><p>Host-side latency terms: <strong>DAVG</strong> (the device/array), <strong>KAVG</strong> (inside the ESXi kernel, usually queueing), <strong>GAVG</strong> (what the guest sees, about DAVG + KAVG).</p>` },
    ],
    yours: `307 VMFS datastores on a Hitachi FC SAN: 1,433 TiB, 64% free. 269 are VMFS 6 and 38 are still VMFS 5. LUNs have 2 paths with Round Robin. HBAs are 16 and 32 Gb. 106 datastores hold no VMs and the lowest has 18% free. In vCenter, open a datastore > Configure > Device Backing to see its LUN, and a host > Storage Devices > Paths to see the paths.`,
    terms: [['LUN', 'A slice of storage presented by the array'], ['Datastore', 'A VMFS (or NFS) container for VM files'], ['VMDK', 'A virtual disk file'], ['Path', 'One route from host to LUN'], ['Round Robin', 'Alternates I/O over paths'], ['Thin provisioning', 'Space used as data is written'], ['Storage vMotion', 'Moves VM disks between datastores'], ['DAVG/KAVG/GAVG', 'Latency at device / kernel / guest']],
  },
  m4: {
    intro: 'VMware networking is a set of virtual switches. If you understand a physical switch, you already know 80% of it.',
    sections: [
      { t: 'The pieces', h: `<ul><li><strong>Uplink (vmnic):</strong> a physical NIC port on the host.</li><li><strong>Virtual switch:</strong> connects VMs to uplinks.</li><li><strong>Port group:</strong> a named network on the switch, usually tied to a <strong>VLAN</strong>. A VM's virtual NIC connects to a port group.</li><li><strong>VMkernel port (vmk):</strong> the host's own IP interface, used for management, vMotion, storage (iSCSI/NFS), vSAN and so on.</li></ul>` },
      { t: 'Standard vs distributed', h: `<p>A <strong>standard vSwitch (vSS)</strong> is configured on each host separately. A <strong>distributed switch (dvSwitch)</strong> is configured once in vCenter and applied to many hosts, so settings stay consistent. It also adds features like better monitoring and traffic shaping.</p>` },
      { t: 'Redundancy and speed', h: `<p>Give a switch two or more uplinks (a <strong>team</strong>) to survive a cable or switch failure and spread traffic. Use the <strong>VMXNET3</strong> virtual NIC for VMs (faster than the old E1000). 10GbE or faster is normal for modern hosts. A 1GbE link makes vMotion and backups slow.</p>` },
      { t: 'VLANs', h: `<p>A VLAN separates traffic on the same cable. The physical switch port is set as a <strong>trunk</strong> carrying many VLANs, and each port group tags its traffic with a VLAN ID.</p>` },
    ],
    yours: `Almost all hosts run 10GbE (46 of 50). 14 distributed switches carry production VMs, and 19 hosts also have a standard vSwitch0. Every host has vmk0 on management. vMotion probably shares the management network, which you should confirm under Host > Configure > VMkernel adapters (look at the enabled services).`,
    terms: [['vmnic', 'A physical NIC port on the host'], ['vSwitch', 'Virtual switch'], ['dvSwitch', 'vCenter-managed switch across hosts'], ['Port group', 'A named VM network, often a VLAN'], ['VMkernel (vmk)', 'The host\'s own IP interface'], ['Trunk', 'Switch port carrying many VLANs'], ['VMXNET3', 'Fast virtual NIC type']],
  },
  m5: {
    intro: 'This module is about what a VM really is, and the housekeeping that keeps an estate healthy.',
    sections: [
      { t: 'A VM is a folder of files', h: `<ul><li><strong>.vmx</strong>: configuration</li><li><strong>.vmdk</strong>: virtual disk (a small descriptor plus a -flat data file)</li><li><strong>.nvram</strong>: BIOS/UEFI settings</li><li><strong>.vswp</strong>: swap file (size = configured RAM minus reservation)</li><li><strong>.vmsd / -delta.vmdk</strong>: snapshot data</li><li><strong>.log</strong>: logs</li></ul>` },
      { t: 'Snapshots', h: `<p>A snapshot freezes the disk and sends new writes to a <strong>delta disk</strong>. It is meant for hours or days (before a change), not weeks. Long-lived snapshots: grow large, slow disk I/O, take a long time to delete or consolidate, and can fill the datastore. A snapshot is <strong>not a backup</strong>.</p>` },
      { t: 'VMware Tools', h: `<p>Software inside the guest OS. It provides better drivers (VMXNET3, PVSCSI), clean shutdown and restart from vCenter, time sync options, heartbeat and accurate IP/OS reporting. Keep it current. "Not running" on a powered-off VM is normal.</p>` },
      { t: 'Templates and cloning', h: `<p>A <strong>template</strong> is a VM that cannot be powered on, used to clone new VMs fast. Keep templates patched. A <strong>clone</strong> is a copy of a VM.</p>` },
      { t: 'Zombies and waste', h: `<p>RVTools flags "possible zombie vmdk" files that no VM in the inventory uses. They may be real waste (left over from deleted VMs), but some can belong to VMs in another vCenter, snapshots or backups. <strong>Never delete based on the report alone.</strong> Check each first. Also review powered-off VMs, empty datastores and oversized VMs.</p>` },
      { t: 'Right-sizing', h: `<p>Most performance problems in VMware come from VMs with too many vCPUs, not too few. A VM with 16 vCPUs that uses 2 cores has to wait for 16 cores to be free. Give VMs what they use, then add if needed.</p>` },
    ],
    yours: `1,185 VMs: 1,041 on, 144 off, 32 templates. Linux 645, Windows Server 498. 79 snapshots on 76 VMs (the oldest from May 2023). 477 VMs can upgrade VMware Tools. 1,166 possible zombie vmdk warnings. 45 VMs have a CD-ROM connected. Most common size: 4 vCPU and 8 GB RAM.`,
    terms: [['VMX', 'VM configuration file'], ['Delta disk', 'Where a snapshot stores new writes'], ['Consolidation', 'Merging delta disks back into the base disk'], ['VMware Tools', 'Guest software for drivers and integration'], ['Template', 'A VM used only for cloning'], ['Right-sizing', 'Matching vCPU/RAM to real use']],
  },
  m6: {
    intro: 'A good engineer has a method. When someone says "it is slow", work from the VM downward and find which resource is short.',
    sections: [
      { t: 'The method', h: `<ol><li><strong>Scope it:</strong> one VM, or many? Since when? What changed (patch, snapshot, migration, new VM, backup)?</li><li><strong>Inside the guest:</strong> CPU, memory, disk queue, network (Task Manager / Resource Monitor / perfmon).</li><li><strong>VM level (vCenter charts):</strong> CPU usage and ready, memory (ballooned, swapped), disk latency, network.</li><li><strong>Host level:</strong> are other VMs on that host also slow? CPU, memory, storage paths.</li><li><strong>Datastore/array:</strong> latency and queueing, shared by many VMs.</li></ol><p>If many VMs on one host are slow, suspect the host. If many VMs on one datastore are slow, suspect the storage.</p>` },
      { t: 'CPU: Ready and Co-stop', h: `<p><strong>CPU Ready</strong> is the time a VM wants to run but no physical core is free. Above about <strong>5% per vCPU</strong> is a concern. Common causes: too many vCPUs per VM, too many VMs per host (overcommit). <strong>Co-stop</strong> is the same problem for multi-vCPU VMs waiting for all their vCPUs to line up. Fix: reduce vCPUs, rebalance, add hosts.</p><p>Note: high CPU <em>usage</em> and high CPU <em>ready</em> are different. A VM can be slow with low usage if it is waiting for ready.</p>` },
      { t: 'Memory', h: `<ul><li><strong>Ballooning:</strong> ESXi asks the guest to give back memory. A sign of host memory pressure.</li><li><strong>Compression and swapping:</strong> worse. Swapping to disk is very slow. Check for it first.</li><li><strong>Limits and reservations:</strong> a memory limit set on a VM can cause swapping even when the host has plenty.</li></ul>` },
      { t: 'Storage latency', h: `<p>Look at read and write latency per datastore. High <strong>DAVG</strong> means the array or fabric is slow. High <strong>KAVG</strong> means queueing inside ESXi (too many I/Os queued on the device). Long-lived snapshots, backups, antivirus scans and one noisy VM can all raise latency for everyone on a datastore.</p>` },
      { t: 'Tools', h: `<ul><li><strong>vCenter performance charts</strong> (history, easy).</li><li><strong>esxtop</strong> (live on the host): <code>c</code> CPU (%RDY, %CSTP), <code>m</code> memory (MCTLSZ balloon, SWCUR swap), <code>d</code> disk (DAVG, KAVG, GAVG), <code>n</code> network.</li><li><strong>Windows perfmon:</strong> % Processor Time, Disk Queue Length, Available MBytes.</li><li><strong>Events, tasks and alarms</strong> in vCenter, and <strong>vmkernel.log</strong> on the host.</li></ul>` },
    ],
    yours: `RVTools reports 12 vCPU-per-core warnings (CPU contention risk), 384 in-memory performance tips and 76 disk I/O tips, and 79 active snapshots. Start your own hunt with these.`,
    terms: [['CPU Ready', 'Time waiting for a physical core'], ['Co-stop', 'Multi-vCPU VM waiting for its vCPUs together'], ['Ballooning', 'Host reclaiming guest memory'], ['Swapping', 'Host memory paged to disk (bad)'], ['DAVG', 'Device latency (array/fabric)'], ['KAVG', 'Kernel latency (queueing)'], ['esxtop', 'Live performance tool on the host']],
  },
  m7: {
    intro: 'Know your own numbers. In an interview, concrete facts about your environment show real experience.',
    sections: [
      { t: 'The 60-second description', h: `<p class="lead">"We run about 50 ESXi 8.0.3 hosts, mostly HPE DL380 and Dell R640/R740, in 9 clusters under vCenter 8.0.3, with HA and DRS on. We have about 1,100 powered-on VMs, roughly 55% Linux and 45% Windows Server, on a Hitachi Fibre Channel SAN with 307 VMFS datastores and Round Robin multipathing. Production traffic runs on distributed switches over 10GbE."</p>` },
      { t: 'What you should be able to say about it', h: `<ul><li>Which hardware generations you have, and why EVC matters when they mix.</li><li>That 38 datastores are still on VMFS 5 and how you would migrate them.</li><li>That one cluster has admission control off, and the HA risk.</li><li>That there are old snapshots and zombie vmdk reports to clean up, and that you verify before deleting.</li><li>What you do not know yet (vMotion network, array model) and how you would find out.</li></ul>` },
      { t: 'Where to look in vCenter', h: `<ul><li><strong>Host Summary:</strong> model, CPU, RAM, ESXi build.</li><li><strong>Cluster > Configure:</strong> HA, DRS, EVC, admission control.</li><li><strong>Datastore > Configure > Device Backing:</strong> LUN and paths.</li><li><strong>Host > Configure > VMkernel adapters:</strong> services on each vmk.</li><li><strong>VM > Edit Settings:</strong> vCPU, RAM, disks, NIC type, CD-ROM.</li><li><strong>VM > Snapshots:</strong> age and size.</li></ul>` },
    ],
    yours: `The Environment page in this app lists all of your numbers. Learn the headline figures by heart: 50 hosts, 9 clusters, about 1,185 VMs, 307 datastores, 1,433 TiB.`,
    terms: [['EVC', 'Needed when CPU generations mix'], ['VMFS 5 → 6', 'Needs new datastore + Storage vMotion'], ['Failover level 1', 'Capacity kept for one host failure']],
  },
};
