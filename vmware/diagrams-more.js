// VMware prep: more interactive diagrams (vMotion, VMFS migration) and static pictures used inside quiz questions.
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
  const info = (t, body) => `<div class="w-info"><strong>${esc(t)}</strong><p>${body}</p></div>`;

  // ============================================================ vMotion: how it works, what blocks it
  VMW.WIDGET_TITLES.vmotion = 'vMotion: how it works and what blocks it';
  W.vmotion = (el) => {
    const STEPS = [
      { t: '1. Check', b: 'vCenter checks that host B can run the VM: compatible CPU, the same networks, access to the same datastore, enough RAM. If any check fails, vMotion is refused before anything moves.', pct: 0, at: 'A', flow: false },
      { t: '2. Copy memory', b: 'The VM keeps running on host A while its memory is copied to host B over the vMotion network. Users notice nothing.', pct: 45, at: 'A', flow: true },
      { t: '3. Copy changes', b: 'Memory pages the VM changed while copying are copied again, over and over, in smaller and smaller rounds, until almost nothing is left.', pct: 90, at: 'A', flow: true },
      { t: '4. Switch over', b: 'The VM is paused for a split second (usually well under a second). The last changes and the CPU state are copied to host B.', pct: 100, at: 'S', flow: true },
      { t: '5. Resume', b: 'The VM resumes on host B and the network is told its new location. Host A lets go of it. The VM never powered off.', pct: 100, at: 'B', flow: false },
    ];
    const BLOCK = [
      ['cd', 'CD-ROM connected to an ISO on host-local storage', 'Host B cannot read that ISO. Disconnect the CD-ROM (or keep ISOs on shared storage).'],
      ['gpu', 'GPU or other passthrough device attached', 'Passthrough ties the VM to a physical device in host A. Plan a power-off migration, or use vGPU where supported.'],
      ['cpu', 'Host B has an older CPU and the cluster has no EVC', 'Enable EVC with a common baseline, or keep VMs on matching hosts.'],
      ['net', 'Port group or VLAN missing on host B', 'Create the same port group on host B (or use a distributed switch).'],
      ['ds', 'Host B cannot see the VM\'s datastore', 'Present the LUN to host B (check zoning and masking), or use Storage vMotion as part of the move.'],
      ['vmk', 'vMotion is not enabled on host B\'s VMkernel port, or that network is down', 'Enable the vMotion service on a VMkernel port and test connectivity between the hosts.'],
    ];
    const st = { i: 0, on: {} };
    const draw = () => {
      const s = STEPS[st.i];
      const hostA = s.at === 'B' ? 'dashed' : '';
      const vmx = s.at === 'B' ? 232 : 32, vmcls = s.at === 'S' ? 'bad' : 'hot';
      const blocked = BLOCK.filter(([k]) => st.on[k]);
      el.innerHTML = frame('vmotion', 'vMotion: moving a running VM', 'Step through how it works, then tick problems to see what would stop it.', `
        <svg viewBox="0 0 340 150" class="d-svg" role="img" aria-label="vMotion between two hosts">
          <rect x="10" y="14" width="130" height="112" rx="12" class="d-box ${hostA ? 'd-plain' : ''}"/><text x="75" y="32" text-anchor="middle" class="d-t">Host A</text>
          <rect x="200" y="14" width="130" height="112" rx="12" class="d-box"/><text x="265" y="32" text-anchor="middle" class="d-t">Host B</text>
          <path d="M140 70 H200" class="d-line ${s.flow ? 'flow' : ''}"/><text x="170" y="62" text-anchor="middle" class="d-s">vMotion net</text>
          <rect x="${vmx}" y="46" width="96" height="40" rx="9" class="d-box ${vmcls}"/><text x="${vmx + 48}" y="70" text-anchor="middle" class="d-t">${s.at === 'S' ? '⏸ paused' : 'VM'}</text>
          ${s.at === 'B' ? '<text x="75" y="70" text-anchor="middle" class="d-s">VM left</text>' : ''}
          <rect x="216" y="98" width="98" height="10" rx="5" class="d-box"/><rect x="216" y="98" width="${(98 * s.pct) / 100}" height="10" rx="5" fill="var(--c2)"/><text x="265" y="120" text-anchor="middle" class="d-s">memory on host B: ${s.pct}%</text>
        </svg>
        <div class="w-ctrl">${STEPS.map((x, k) => `<button class="btn ghost ${k === st.i ? 'on' : ''}" data-s="${k}">${esc(x.t)}</button>`).join('')}</div>
        <div class="w-panel" aria-live="polite">${info(s.t, esc(s.b))}</div>
        <div class="w-title" style="margin-top:16px">Will it vMotion?</div>
        <p class="w-hint">Tick what applies to the VM you want to move.</p>
        <div class="checks">${BLOCK.map(([k, l]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${st.on[k] ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
        <div class="w-panel" aria-live="polite">${blocked.length ? info(`Blocked ✕ (${blocked.length} problem${blocked.length > 1 ? 's' : ''})`, blocked.map(([, l, f]) => `<strong>${esc(l)}</strong><br>${esc(f)}`).join('<br><br>')) : info('Should work ✓', 'Nothing in the list blocks it. vCenter will still run its own compatibility checks first.')}</div>`);
      tap(el, '[data-s]', (b) => { st.i = +b.dataset.s; draw(); });
      $$('[data-k]', el).forEach((c) => (c.onchange = () => { st.on[c.dataset.k] = c.checked; draw(); }));
    };
    draw();
  };

  // ============================================================ VMFS 5 -> VMFS 6 migration
  VMW.WIDGET_TITLES.vmfsmig = 'Move from VMFS 5 to VMFS 6 (step by step)';
  W.vmfsmig = (el) => {
    const VMS = 6;
    const st = { step: 0, moved: 0 };
    const LABEL = ['Request a new LUN', 'Create the VMFS 6 datastore', 'Storage vMotion the next VM', 'Unmount the old datastore', 'Return the old LUN', 'Start again'];
    const TEXT = [
      ['Starting point', 'Six VMs live on a VMFS 5 datastore. There is no in-place upgrade to VMFS 6, so the plan is: new datastore, move the VMs, retire the old one.'],
      ['1. Ask the storage team for a new LUN', 'Same size or bigger, presented to every host in the cluster (zoning and masking). Check there is free space on the array first.'],
      ['2. Create the VMFS 6 datastore', 'In vCenter: new datastore on that LUN, VMFS version 6. Name it clearly. Confirm every host can see it.'],
      ['3. Storage vMotion, a few VMs at a time', 'Each VM moves with no downtime, but it generates heavy I/O. Start with non-production, avoid backup windows, and watch datastore latency.'],
      ['4. Unmount the old datastore', 'Only when it is empty. Check for ISOs, templates, scratch files, and that it is not a vSphere HA heartbeat datastore. Then unmount and detach it.'],
      ['5. Return the old LUN', 'Ask the storage team to unpresent and reclaim the LUN. Done: 1 of your 38 VMFS 5 datastores is gone.'],
    ];
    const draw = () => {
      const oldVMs = VMS - st.moved, newVMs = st.moved, newMade = st.step >= 2, oldGone = st.step >= 4;
      const chips = (n) => Array.from({ length: n }, () => '<i></i>').join('') || '<small>empty</small>';
      const next = st.step === 3 && st.moved < VMS ? LABEL[2] + ` (${st.moved}/${VMS} done)` : LABEL[st.step === 3 ? 3 : st.step];
      el.innerHTML = frame('vmfsmig', 'Retiring a VMFS 5 datastore', 'Press the button to do each step. This is the safe order.', `
        <div class="dsmig">
          <div class="dsm ${oldGone ? 'gone' : ''}"><strong>Old: VMFS 5</strong><div class="chipsrow">${oldGone ? '<small>unmounted</small>' : chips(oldVMs)}</div></div>
          <span class="dsarrow">${st.step === 3 ? '➜ Storage vMotion' : '➜'}</span>
          <div class="dsm ${newMade ? 'new' : 'off'}"><strong>New: VMFS 6</strong><div class="chipsrow">${newMade ? chips(newVMs) : '<small>not created yet</small>'}</div></div>
        </div>
        <div class="w-ctrl"><button class="btn primary" id="go">${esc(next)}</button>${st.step > 0 ? '<button class="btn ghost" id="rs">Reset</button>' : ''}</div>
        <div class="w-panel" aria-live="polite">${info(...TEXT[Math.min(st.step, 5)].map((x, i) => (i ? esc(x) : x)))}${info('Why VMFS 6?', 'It reclaims deleted space on the array automatically (UNMAP), and VMFS 5 is the older generation. In your environment 269 datastores are already VMFS 6 and 38 are VMFS 5.')}</div>`);
      el.querySelector('#go').onclick = () => {
        if (st.step === 0) st.step = 1;
        else if (st.step === 1) st.step = 2;
        else if (st.step === 2) { st.step = 3; st.moved = 1; }
        else if (st.step === 3) { if (st.moved < VMS) st.moved++; else st.step = 4; }
        else if (st.step === 4) st.step = 5;
        else { st.step = 0; st.moved = 0; }
        draw();
      };
      const r = el.querySelector('#rs'); if (r) r.onclick = () => { st.step = 0; st.moved = 0; draw(); };
    };
    draw();
  };

  // ============================================================ static pictures for quiz questions
  VMW.FIGS = {};
  const box = (x, y, w, h, label, cls = '', sub = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="d-box ${cls}"/><text x="${x + w / 2}" y="${y + (sub ? h / 2 - 1 : h / 2 + 4)}" text-anchor="middle" class="d-t">${esc(label)}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" class="d-s">${esc(sub)}</text>` : ''}`;
  const hbox = (x, y, w, h, label, cls = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="d-box ${cls}"/><text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" class="d-t">${esc(label)}</text>`;
  const ln = (d, cls = '') => `<path d="${d}" class="d-line ${cls}" fill="none"/>`;
  const svg = (h, inner, label) => `<svg viewBox="0 0 340 ${h}" class="d-svg" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const dots = (x, y, n, cls = '') => Array.from({ length: n }, (_, i) => `<circle cx="${x + (i % 4) * 11}" cy="${y + Math.floor(i / 4) * 11}" r="4" class="d-dot ${cls}"/>`).join('');
  const F = VMW.FIGS;

  F.numa = () => svg(112, `<rect x="6" y="6" width="328" height="100" rx="14" class="d-chassis"/>
    ${box(20, 20, 130, 72, 'Socket 1', '', '32 cores + 1 TB RAM')}${box(190, 20, 130, 72, 'Socket 2', '', '32 cores + 1 TB RAM')}
    ${ln('M150 56 H190')}<text x="170" y="48" text-anchor="middle" class="d-s">link</text>`, 'A host with two sockets');
  F.hafail0 = () => svg(120, `${hbox(10, 14, 92, 76, 'Host 1')}${dots(30, 50, 4)}${hbox(124, 14, 92, 76, 'Host 2', 'bad')}${dots(144, 50, 4, 'dim')}<text x="170" y="82" text-anchor="middle" class="d-x">✕ failed</text>${hbox(238, 14, 92, 76, 'Host 3')}${dots(258, 50, 3)}`, 'Host 2 has failed');
  F.hafail1 = () => svg(124, `${hbox(10, 14, 92, 76, 'Host 1')}${dots(30, 46, 7)}${hbox(124, 14, 92, 76, 'Host 2', 'bad')}<text x="170" y="62" text-anchor="middle" class="d-x">✕ failed</text>${hbox(238, 14, 92, 76, 'Host 3')}${dots(258, 46, 6)}${ln('M124 94 C100 114 80 112 70 96', 'flow')}${ln('M216 94 C240 114 260 112 270 96', 'flow')}<text x="170" y="120" text-anchor="middle" class="d-s">VMs restarted on the other hosts</text>`, 'HA restarts the VMs on the other hosts');
  F.twohost = () => svg(96, `${hbox(30, 10, 120, 60, 'Host 1')}<text x="90" y="52" text-anchor="middle" class="d-s">capacity: 100%</text>${hbox(190, 10, 120, 60, 'Host 2')}<text x="250" y="52" text-anchor="middle" class="d-s">capacity: 100%</text><text x="170" y="90" text-anchor="middle" class="d-s">2-host cluster, failover level 1</text>`, 'A two-host cluster');
  F.twohost1 = () => svg(104, `${hbox(30, 10, 120, 60, 'Host 1')}<rect x="30" y="26" width="60" height="44" rx="6" class="d-fill"/><text x="60" y="54" text-anchor="middle" class="d-t">50%</text>${hbox(190, 10, 120, 60, 'Host 2')}<rect x="190" y="26" width="60" height="44" rx="6" class="d-fill"/><text x="220" y="54" text-anchor="middle" class="d-t">50%</text><text x="170" y="94" text-anchor="middle" class="d-s">if one fails, the other must hold both halves</text>`, 'Each host uses about half');
  F.chainQ = () => svg(214, `${box(70, 6, 200, 30, 'Windows VM · C: drive')}${box(70, 48, 200, 30, '?', 'hot')}${box(70, 90, 200, 30, '?', 'hot')}${box(70, 132, 200, 30, '?', 'hot')}${box(70, 174, 200, 30, 'Hitachi array (real disks)')}${ln('M170 36 V48')}${ln('M170 78 V90')}${ln('M170 120 V132')}${ln('M170 162 V174')}`, 'A chain from the VM down to the array with three unknown layers');
  F.chain = () => svg(214, `${box(70, 6, 200, 30, 'Windows VM · C: drive')}${box(70, 48, 200, 30, 'VMDK file', 'ok')}${box(70, 90, 200, 30, 'Datastore (VMFS)', 'ok')}${box(70, 132, 200, 30, 'LUN (+ HBA, FC fabric)', 'ok')}${box(70, 174, 200, 30, 'Hitachi array (real disks)')}${ln('M170 36 V48')}${ln('M170 78 V90')}${ln('M170 120 V132')}${ln('M170 162 V174')}`, 'VM, VMDK, datastore, LUN, array');
  F.paths = () => svg(120, `${box(10, 36, 80, 48, 'Host')}${box(250, 36, 80, 48, 'Array')}${ln('M90 50 C140 14 200 14 250 50', 'flow')}${ln('M90 70 C140 106 200 106 250 70', 'flow')}<text x="170" y="12" text-anchor="middle" class="d-s">path 1</text><text x="170" y="116" text-anchor="middle" class="d-s">path 2</text>`, 'A host and an array joined by two paths');
  F.layers = () => svg(190, `${box(60, 6, 220, 36, 'Guest OS (Windows / Linux)')}${box(60, 52, 220, 36, 'ESXi storage stack (kernel)')}${box(60, 98, 220, 36, 'HBA, cable, FC fabric')}${box(60, 144, 220, 36, 'Storage array and disks')}${ln('M170 42 V52')}${ln('M170 88 V98')}${ln('M170 134 V144')}`, 'The layers an I/O passes through');
  F.latency = () => svg(190, `${box(60, 6, 170, 36, 'Guest OS')}${box(60, 52, 170, 36, 'ESXi kernel')}${box(60, 98, 170, 36, 'HBA, cable, FC fabric')}${box(60, 144, 170, 36, 'Storage array and disks')}${ln('M145 42 V52')}${ln('M145 88 V98')}${ln('M145 134 V144')}
    <path d="M240 10 V176" class="d-line" /><text x="288" y="96" text-anchor="middle" class="d-t">GAVG</text><text x="288" y="110" text-anchor="middle" class="d-s">what the guest sees</text>
    <path d="M236 56 V84" class="d-line flow"/><text x="288" y="50" text-anchor="middle" class="d-t">KAVG</text><text x="288" y="62" text-anchor="middle" class="d-s">kernel queue</text>
    <path d="M236 102 V176" class="d-line flow"/><text x="288" y="140" text-anchor="middle" class="d-t">DAVG</text><text x="288" y="154" text-anchor="middle" class="d-s">device</text>`, 'DAVG, KAVG and GAVG on the I/O path');
  F.netpath = () => svg(204, `${box(20, 6, 130, 28, 'VM')}${box(190, 6, 130, 28, 'VM')}${box(20, 50, 300, 28, 'A named network on the switch', 'hot')}${box(20, 94, 300, 28, 'Virtual switch')}${box(40, 138, 110, 28, 'vmnic0')}${box(190, 138, 110, 28, 'vmnic1')}${box(20, 174, 300, 26, 'Physical switch (trunk)')}${ln('M85 34 V50')}${ln('M255 34 V50')}${ln('M170 78 V94')}${ln('M95 122 V138')}${ln('M245 122 V138')}${ln('M95 166 V174')}${ln('M245 166 V174')}`, 'From VMs to the physical switch');
  F.snapQ = () => svg(100, `${box(10, 20, 130, 56, 'Base disk', '', 'frozen at snapshot time')}${ln('M140 48 H196', 'flow')}<text x="168" y="38" text-anchor="middle" class="d-s">new writes</text>${box(196, 20, 130, 56, '?', 'hot')}`, 'A base disk and an unknown block that receives new writes');
  F.snapchain = () => svg(100, `${box(10, 20, 130, 56, 'Base disk', '', 'frozen at snapshot time')}${ln('M140 48 H196', 'flow')}<text x="168" y="38" text-anchor="middle" class="d-s">new writes</text>${box(196, 20, 130, 56, 'Delta disk', 'ok', 'grows over time')}`, 'New writes go to the delta disk');
  F.readyQ = () => svg(110, `<text x="10" y="18" class="d-s">One VM's time, left to right</text>
    <rect x="10" y="30" width="60" height="30" rx="4" fill="var(--ok)"/><rect x="70" y="30" width="80" height="30" rx="4" fill="var(--bad)"/><rect x="150" y="30" width="50" height="30" rx="4" fill="var(--ok)"/><rect x="200" y="30" width="90" height="30" rx="4" fill="var(--bad)"/><rect x="290" y="30" width="40" height="30" rx="4" fill="var(--ok)"/>
    <text x="10" y="84" class="d-s">Green = one kind of time, red = another. The VM looks idle inside.</text>`, 'A timeline with green and red blocks');
  F.ready = () => svg(110, `<text x="10" y="18" class="d-s">One VM's time, left to right</text>
    <rect x="10" y="30" width="60" height="30" rx="4" fill="var(--ok)"/><rect x="70" y="30" width="80" height="30" rx="4" fill="var(--bad)"/><rect x="150" y="30" width="50" height="30" rx="4" fill="var(--ok)"/><rect x="200" y="30" width="90" height="30" rx="4" fill="var(--bad)"/><rect x="290" y="30" width="40" height="30" rx="4" fill="var(--ok)"/>
    <text x="10" y="84" class="d-s">Green: running on a core.  Red: CPU Ready (waiting for a core).</text><text x="10" y="100" class="d-s">The guest shows low usage because it counts only the green.</text>`, 'Green is running, red is CPU Ready');
})();
