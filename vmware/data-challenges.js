// VMware prep: scenario challenges (open answers, self-check against a rubric, AI review).
// Format: [module, level, title, scenario, [rubric points], model answer]
window.VMW = window.VMW || {};

(() => {
  const RAW = [
    ['m7', 'Warm-up', 'Describe your environment in 60 seconds',
      'The interviewer says: "Tell me about the VMware environment you support." Answer out loud, then write it down.',
      ['Scale: about 50 hosts, 9 clusters, about 1,100 powered-on VMs', 'vSphere version: vCenter and ESXi 8.0.3', 'Hardware: HPE DL380 and Dell R640/R740', 'Storage: Hitachi FC SAN, VMFS, Round Robin', 'Network: distributed switches, 10GbE', 'HA and DRS on'],
      'We run about 50 ESXi 8.0.3 hosts, mostly HPE DL380 and Dell R640/R740, in 9 clusters under vCenter 8.0.3, with HA and DRS on. There are about 1,100 powered-on VMs, roughly 55% Linux and 45% Windows Server. Storage is a Hitachi Fibre Channel SAN with 307 VMFS datastores and Round Robin multipathing. Production networking is on distributed switches over 10GbE. My role is [say what you actually do: patching, VM builds, Windows, troubleshooting].'],

    ['m3', 'Core', 'A datastore is at 5% free',
      'An alert says one VMFS datastore has 5% free space. Dozens of VMs are on it. What do you do, in order?',
      ['Find what uses the space (snapshots, thin disks that grew, large or powered-off VMs)', 'Do not just delete files blindly', 'Free space safely: consolidate/delete snapshots with owner approval, or Storage vMotion VMs to another datastore', 'Check other datastores have room first', 'Tell the VM owners and stop new deployments to it', 'Longer term: alarms at 80/90%, capacity planning, ask storage team for more'],
      'First I check which VMs use the space and why: big snapshots, thin disks that have grown, or powered-off VMs. I do not delete anything I cannot identify. The safest quick wins are Storage vMotion of one or two large VMs to a datastore with free space, or removing old snapshots after the owner agrees (checking there is space to consolidate). I tell the owners and pause new VMs on that datastore. Afterwards I set alerts at 80% and 90%, and raise capacity with the storage team if it keeps growing.'],

    ['m2', 'Core', 'A host fails at 3 a.m.',
      'A host in the Internal cluster (admission control off) loses power at 3 a.m. What happens, and what do you check?',
      ['HA detects the failure and restarts VMs on other hosts (short outage)', 'Admission control is off, so capacity is not guaranteed', 'Check which VMs failed to restart and why (resources, rules)', 'Check hardware in iLO/iDRAC (PSU, power feeds, memory)', 'Check DRS rebalanced and cluster is healthy', 'Follow-up: fix, patch, add capacity or turn on admission control'],
      'HA notices the host is gone and restarts its VMs on the remaining hosts, so there is a short outage. Because admission control is off in that cluster, there is no guarantee of enough spare capacity, so I first check whether any VMs failed to restart and why. In parallel I look at the failed server in iLO/iDRAC to find the cause (power supply, power feed, memory or motherboard). When the host returns I let DRS rebalance, and I raise the lack of admission control with the team.'],

    ['m5', 'Core', 'A snapshot from May 2023',
      'You find a snapshot on a production VM that is about 3.5 years old. What do you do?',
      ['Explain the risk: large delta, slow I/O, long or failed consolidation, datastore space', 'Confirm with the VM/application owner that it is not needed', 'Check backup status and datastore free space before deleting', 'Pick a quiet maintenance window', 'Delete (consolidate) and monitor the task, then confirm no "consolidation needed" message', 'Prevent it happening again (policy, alerts, report)'],
      'A snapshot that old can have a huge delta disk, slows I/O and can take a long time to delete. I would confirm with the owner that it is not needed, check there is enough space on the datastore and that backups are good, then delete it in a quiet window and watch the task. Afterwards I check the VM has no "consolidation needed" warning. To stop it happening again I would report on snapshot age and set a rule such as "no snapshot over 3 days".'],

    ['m3', 'Core', 'Move off VMFS 5',
      '38 of your datastores are on VMFS 5. Your manager asks you to move to VMFS 6. How?',
      ['No in-place upgrade from 5 to 6', 'Ask the storage team for new LUNs', 'Create new VMFS 6 datastores', 'Storage vMotion VMs, a few at a time, non-production first', 'Check free space, performance impact and backups/replication', 'Remove the old datastore and return the LUN'],
      'There is no in-place upgrade, so I would ask the storage team for new LUNs, create VMFS 6 datastores, then Storage vMotion the VMs across a few at a time, starting with non-production. I would watch latency during the moves, avoid backup windows, and when a VMFS 5 datastore is empty I would unmount it and have the LUN removed.'],

    ['m2', 'Core', 'A VM will not vMotion',
      'DRS tried and a manual vMotion also failed for one VM. What do you check?',
      ['CD-ROM or ISO connected (especially on local storage)', 'Passthrough devices such as a GPU', 'CPU compatibility between source and target (EVC)', 'Destination host can see the same datastore and networks (port group/VLAN)', 'vMotion network/vmk is configured and working', 'The exact error message in the task'],
      'I read the error first. Then I check for a connected CD-ROM/ISO or a passthrough device, whether the target host can see the VM\'s datastore and port group, whether CPU types are compatible (EVC), and that the vMotion VMkernel network works between the two hosts.'],

    ['m6', 'Core', '"The server is slow"',
      'A user says a Windows VM is slow. You are a VMware and Windows admin. What is your method?',
      ['Scope: one VM or many, when it started, what changed', 'Check inside the guest: CPU, memory, disk queue, network', 'Check VM metrics in vCenter: CPU usage and ready, memory ballooned/swapped, disk latency', 'Compare with other VMs on the same host and datastore', 'Look at host and datastore level if several VMs are affected', 'Check snapshots, backups, antivirus, recent patches'],
      'First I scope it: just this VM or others too, since when, and what changed. Then I look inside Windows for the busy resource, and in vCenter at CPU ready, memory ballooning/swapping and disk latency for that VM. I compare with other VMs on the same host and datastore: if many are slow, it is the host or the storage. I also check snapshots, backups, antivirus and recent patches.'],

    ['m6', 'Hard', 'Low CPU usage but slow',
      'A VM with 16 vCPUs is slow, but Task Manager shows only 10% CPU. vCenter shows CPU Ready of 12%. What is happening and what do you do?',
      ['CPU Ready means the VM waits for physical cores', 'Usage inside the guest does not show waiting time', 'Likely too many vCPUs for the workload or an over-committed host', 'Reduce vCPUs to match real use', 'Check the host\'s other VMs and consider DRS/rebalancing', 'Verify with esxtop %RDY and %CSTP'],
      'CPU Ready means the VM is waiting for physical cores before it can run, which the guest cannot see as usage. A 16 vCPU VM needs many cores free at once. I would reduce its vCPUs to what it really uses, check how many vCPUs are on that host overall, and verify with esxtop (%RDY and %CSTP).'],

    ['m3', 'Hard', 'High storage latency',
      'Several VMs on one datastore report 45 ms latency. How do you find the cause?',
      ['Check whether it is DAVG (array/fabric) or KAVG (queueing in ESXi)', 'Find a noisy VM (high IOPS or throughput)', 'Check snapshots and backup jobs at that time', 'Check paths: failed paths, policy, one HBA overloaded', 'Check the array side (controller load, LUN, RAID/flash) with the storage team', 'Mitigate: Storage vMotion the noisy VM or spread VMs'],
      'I split the latency: high DAVG points to the array or fabric, high KAVG to queueing in ESXi. I look for a noisy VM, snapshots or a backup running at the time, and check that all paths are active and the policy is Round Robin. If DAVG is high I involve the storage team to look at the array. A quick mitigation is to Storage vMotion the noisiest VM to another datastore.'],

    ['m4', 'Core', 'A VM lost its network after vMotion',
      'After DRS moved a VM, it can no longer reach the network. Other VMs on the target host are fine. What is likely wrong?',
      ['A port group/VLAN mismatch on the destination host (standard switch)', 'VM is on a port group that does not exist or is untagged there', 'Check the physical switch trunk allows the VLAN on that host\'s uplinks', 'Check uplinks and NIC teaming on the target host', 'Check the VM\'s NIC is connected, and the guest settings', 'Fix by aligning port groups (or use a distributed switch)'],
      'Most likely the destination host has a different port group or VLAN configuration, which happens with standard vSwitches. I compare the VM\'s port group on both hosts, check the physical switch trunk allows that VLAN on the target host\'s uplinks, and confirm the NIC is connected. A distributed switch avoids this kind of mismatch.'],

    ['m5', 'Core', 'RVTools shows 1,166 zombie vmdk files',
      'Your colleague says "just delete them, they are zombies". What do you say and do?',
      ['The report only says "possible" zombie', 'Some may belong to snapshots, templates, other vCenters or backups', 'Verify each against the inventory and datastore browser', 'Check last modified date and ask owners', 'Move or rename first, delete after a waiting period', 'Document what is removed'],
      'I would not delete them. RVTools only flags files that are not attached to a VM it can see, but they may belong to snapshots, VMs in another vCenter, or backups. I would check each against the inventory, last-modified dates and owners, move or rename a candidate first, wait a few weeks and then delete, keeping a record.'],

    ['m2', 'Hard', 'The GPU cluster shows HA warnings',
      'The GPU cluster has warnings: "isolation address could not be reached" and "too few heartbeat datastores". Explain what they mean and the risk.',
      ['HA uses network heartbeat plus datastore heartbeat to decide a host failed or is isolated', 'The isolation address is an IP the host pings to detect isolation', 'If unreachable, a host may wrongly think it is isolated and trigger the isolation response (e.g. power off/shut down VMs)', 'HA wants at least 2 heartbeat datastores', 'Fix: set a reachable isolation address (das.isolationaddress) and add shared datastores', 'Test carefully, as these hosts run GPU workloads'],
      'HA decides whether a host is dead or just isolated using network heartbeats, an isolation address it pings, and heartbeat datastores. If the isolation address is unreachable, a healthy host might believe it is isolated and apply the isolation response, which could power off VMs. Too few heartbeat datastores reduces HA\'s ability to tell a failed host from a partitioned one. I would set a reachable isolation address, add shared datastores for heartbeating, and test carefully because these hosts run GPU workloads.'],

    ['m1', 'Core', 'Size a new VM',
      'A developer asks for a VM with 16 vCPUs and 128 GB RAM "to be safe". What do you do?',
      ['Ask about the workload and expected usage', 'Explain the risks of over-sizing (CPU Ready, NUMA, wasted memory, swap file size)', 'Start smaller and measure', 'Right-size after observing real usage', 'Consider NUMA size of the hosts', 'Agree a process to increase later'],
      'I would ask what the application needs and explain that over-sizing can slow the VM (CPU Ready, NUMA spanning) and waste host capacity. I would start smaller, such as 4 to 8 vCPUs, monitor for a few weeks, and increase if the data shows it is needed.'],

    ['m1', 'Hard', 'Mixed CPU generations',
      'Your clusters have hosts with Skylake CPUs (R640) and Sapphire Rapids (Gen11). Why does this matter and what do you check?',
      ['vMotion between very different CPU generations can fail without EVC', 'EVC mode sets a common baseline for the cluster', 'Check each cluster\'s EVC mode and whether hosts are mixed', 'EVC limits new CPU features, so it can reduce performance for some workloads', 'Newer hosts handle more load per core; DRS does not know about it', 'Plan to keep clusters as uniform as possible'],
      'A running VM cannot be vMotioned between CPUs with different instruction sets unless the cluster uses EVC with a common baseline. I check each cluster\'s EVC mode and whether it mixes generations. The trade-off is that EVC hides newer CPU features. Where possible I keep clusters uniform.'],

    ['m4', 'Hard', 'vMotion shares the management network',
      'You notice only vmk0 exists on each host. What does that suggest, and is it a problem?',
      ['vMotion probably shares the management network (confirm in VMkernel adapter services)', 'Management and vMotion traffic compete for the same link', 'Large vMotions can saturate the link and affect management or HA heartbeats', 'Best practice is a separate vMotion VMkernel port (and VLAN)', 'On 10GbE it can work, but check', 'Verify first before concluding'],
      'It suggests vMotion is enabled on the management VMkernel port, which I would confirm in each host\'s VMkernel adapter services. Sharing the link means big vMotions compete with management and HA traffic. The recommended design is a separate vMotion VMkernel port on its own VLAN. On 10GbE it can be acceptable, but I would check how it behaves.'],

    ['m6', 'Hard', 'Memory pressure on a host',
      'vCenter shows ballooning and some swapping on VMs on one host. How do you respond?',
      ['Ballooning and swapping mean the host is short of memory', 'Swapping is much more serious than ballooning', 'Check host memory usage, and which VMs use the most', 'vMotion some VMs away (DRS) or add capacity', 'Check for memory limits set on VMs', 'Check whether VMs are over-sized for RAM'],
      'Ballooning means the host is reclaiming memory from guests, and swapping means it has gone further, which hurts performance. I check host memory use and the biggest consumers, move VMs to other hosts (DRS or manual vMotion), and check whether limits are set. Longer term I right-size over-allocated VMs or add capacity.'],

    ['m7', 'Hard', 'Interview curveball: "What would you improve?"',
      'The interviewer asks what you would improve in your VMware environment. Use your own data.',
      ['Old snapshots and zombie vmdk clean-up (with verification)', 'Move 38 VMFS 5 datastores to VMFS 6', 'Review admission control on the Internal cluster', 'Fix GPU cluster HA warnings', 'Check NTP on 3 hosts and Tools upgrades', 'Review vMotion network design and 1GbE/slow links'],
      'From our reports: clean up old snapshots and verified zombie files, move the 38 VMFS 5 datastores to VMFS 6, review admission control on the Internal cluster, fix the HA warnings on the GPU cluster, fix NTP on three hosts, plan VMware Tools upgrades, and check whether vMotion should have its own network. I would prioritise by risk: snapshots, HA settings and NTP first.'],

    ['m3', 'Hard', 'LUN and datastore question',
      '"What is the difference between a LUN, a datastore and a VMDK?" Explain it simply with an example from your environment.',
      ['LUN: storage presented by the array', 'Datastore: VMFS file system on the LUN', 'VMDK: a VM\'s virtual disk file in the datastore', 'Chain: Windows C: drive → VMDK → datastore → LUN → array', 'One datastore can hold many VMDKs', 'Your setup: FC SAN, 2 paths, Round Robin'],
      'The array creates a LUN and presents it to the hosts over Fibre Channel. ESXi formats the LUN with VMFS, which is a datastore. A VM\'s C: drive is a VMDK file in that datastore. So the chain is C: drive, VMDK, datastore, LUN, array. One datastore usually holds many VMDKs, and each LUN in our environment has two paths with Round Robin.'],

    ['m2', 'Core', 'Explain HA vs DRS vs vMotion',
      'In two minutes, explain HA, DRS and vMotion and how they relate.',
      ['vMotion: live move of a running VM between hosts', 'DRS: uses vMotion to balance load automatically', 'HA: restarts VMs after a host failure (outage)', 'DRS = balance, HA = recover', 'All need clusters and shared storage', 'Admission control keeps room for HA'],
      'vMotion moves a running VM from one host to another with no downtime. DRS is the automation that uses vMotion to balance load across hosts. HA is different: when a host fails, it restarts the failed host\'s VMs on other hosts. So DRS balances, HA recovers. They all need a cluster and shared storage, and admission control keeps spare capacity so HA can work.'],

    ['m5', 'Core', 'Handover note for a new engineer',
      'Write five rules of VMware hygiene you would give a new engineer.',
      ['Snapshots are short-lived and never a backup', 'Right-size VMs, start small', 'Verify before deleting anything', 'Disconnect CD-ROM/ISO when done', 'Keep VMware Tools and ESXi consistent', 'Watch datastore free space and latency'],
      '1) Snapshots are for days, not years, and are not backups. 2) Start VMs small and right-size from data. 3) Verify before deleting any file or VM. 4) Disconnect ISOs when done. 5) Keep Tools, ESXi and NTP consistent. 6) Watch datastore free space and latency.'],
  ];

  VMW.CHALLENGES = RAW.map(([mod, level, title, scenario, rubric, model], i) => ({ id: `c-${String(i).padStart(2, '0')}`, mod, level, title, scenario, rubric, model }));
})();
