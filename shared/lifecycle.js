// ASSET LIFECYCLE — Dispose + Missing (Admin and Accounting).
//
//  • DISPOSE replaces "Delete". The asset is never erased: it is flagged
//    is_deleted = true and keeps WHY (sold, donated, scrapped, ...), WHEN,
//    who did it, and remarks. Admin can see them in Settings → Disposed Items
//    and restore one if it was a mistake.
//  • MISSING is for items NOT FOUND during a physical count. A missing item is
//    removed from the dashboard and from future counts, and listed under
//    Settings → Missing Items, where it can later be marked FOUND (returns to
//    the active list) or WRITTEN OFF (becomes Disposed — "Lost / Stolen").
//
// Every one of these actions is also written to the permanent history log,
// so they appear in the Monthly Report.
(function () {
  const DISPOSAL_REASONS = [
    'SOLD',
    'DONATED',
    'SCRAPPED / OBSOLETE',
    'TRANSFERRED OUT',
    'LOST / STOLEN',
    'OTHER',
  ];
  let missingRows = [];

  const el = (id) => document.getElementById(id);
  function canManage() {
    return (
      typeof activeUserSession !== 'undefined' &&
      activeUserSession &&
      (activeUserSession.role === 'ADMIN' || activeUserSession.role === 'ACCOUNTING')
    );
  }

  // ===================================================================
  // DISPOSE
  // ===================================================================
  function ensureDisposeModal() {
    if (el('disposeAssetModal')) return;
    const modal = document.createElement('div');
    modal.id = 'disposeAssetModal';
    modal.className = 'modal-backdrop no-print';
    modal.style.zIndex = '650'; // must sit ABOVE the Missing Items popup (it opens from there too)
    modal.innerHTML = `
      <div class="modal-box">
        <h3>📦 Dispose Asset</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:14px;">
          The asset is taken off the active list but <strong>never erased</strong> — it stays on record
          with the reason below. An Admin can restore it from Settings → Disposed Items.
        </p>
        <div class="form-field" style="margin-bottom:12px;">
          <label>Asset</label>
          <input type="text" id="disposeAssetLabel" readonly style="background:#f1f5f9;" />
        </div>
        <div class="form-grid-2" style="margin-bottom:12px;">
          <div class="form-field">
            <label>Reason *</label>
            <select id="disposeReason">
              <option value="">— Select reason —</option>
              ${DISPOSAL_REASONS.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Disposal Date *</label>
            <input type="date" id="disposeDate" />
          </div>
        </div>
        <div class="form-field">
          <label>Remarks <span id="disposeRemarksHint" style="color:#94a3b8;">(optional)</span></label>
          <textarea id="disposeRemarks" rows="3" placeholder="e.g. sold to ABC Corp, OR #1234 / scrapped after fire / donated to ..."
            style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; font-family:inherit;"></textarea>
        </div>
        <div id="disposeError" style="display:none; color:#dc2626; font-size:12px; margin-top:8px;"></div>
        <div class="modal-actions">
          <button type="button" id="disposeCancelBtn" class="action-btn" style="background:#e2e8f0; color:#334155;">Cancel</button>
          <button type="button" id="disposeConfirmBtn" class="action-btn" style="background:#dc2626; color:#fff;">Dispose Asset</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    el('disposeCancelBtn').addEventListener('click', closeDisposeModal);
    el('disposeReason').addEventListener('change', () => {
      el('disposeRemarksHint').textContent =
        el('disposeReason').value === 'OTHER' ? '(required for "Other")' : '(optional)';
    });
  }

  function closeDisposeModal() {
    const m = el('disposeAssetModal');
    if (m) m.style.display = 'none';
  }

  // options: { presetReason, name, onDone }
  async function disposeAssetRecord(assetId, options = {}) {
    if (!canManage()) return;
    if (!supabaseClient) return alert('Not connected to the database. Check the console for details.');
    ensureDisposeModal();

    const known = (window.lastRenderedAssetRows || []).find((r) => r.id === assetId);
    const name = options.name || (known ? known.name : '');
    el('disposeAssetLabel').value = name ? `${assetId} — ${name}` : assetId;
    el('disposeReason').value = options.presetReason || '';
    el('disposeDate').value = todayLocalISO();
    el('disposeDate').max = todayLocalISO();
    el('disposeRemarks').value = '';
    el('disposeRemarksHint').textContent = '(optional)';
    el('disposeError').style.display = 'none';
    el('disposeAssetModal').style.display = 'flex';

    // Replace the confirm button so old listeners from a previous asset don't stack up.
    const oldBtn = el('disposeConfirmBtn');
    const btn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    btn.disabled = false;
    btn.addEventListener('click', async () => {
      const reason = el('disposeReason').value;
      const date = el('disposeDate').value;
      const remarks = el('disposeRemarks').value.trim();
      const fail = (msg) => {
        el('disposeError').textContent = msg;
        el('disposeError').style.display = 'block';
      };
      if (!reason) return fail('Please choose a reason.');
      if (!date) return fail('Please choose the disposal date.');
      if (date > todayLocalISO()) return fail('The disposal date cannot be in the future.');
      if (reason === 'OTHER' && !remarks) return fail('Remarks are required when the reason is "Other".');

      btn.disabled = true;
      const { error } = await supabaseClient
        .from('assets')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: activeUserSession.email,
          disposal_reason: reason,
          disposal_date: date,
          disposal_remarks: remarks || null,
          is_missing: false, // a written-off missing item is no longer "missing"
        })
        .eq('id', assetId);
      if (error) {
        console.error('Supabase dispose error:', error);
        btn.disabled = false;
        return fail('Failed to dispose asset: ' + error.message);
      }
      await logAssetEvent(
        assetId,
        'Asset Disposed',
        name,
        `${reason} (${date})${remarks ? ' — ' + remarks : ''}`
      );
      closeDisposeModal();
      if (typeof showToast === 'function') showToast(`Asset ${assetId} disposed (${reason}).`, 'success');
      if (typeof searchAssets === 'function') searchAssets();
      if (typeof options.onDone === 'function') options.onDone();
    });
  }

  // ===================================================================
  // MISSING — marked from the Physical Count screen
  // ===================================================================
  // entries: [{ item, remarks }]   →   { ok: [ids], failed: [{id, message}] }
  async function markAssetsMissingFromCount(entries, countDate) {
    const ok = [];
    const failed = [];
    const nowIso = new Date().toISOString();
    const email = activeUserSession.email;

    for (let i = 0; i < entries.length; i += 10) {
      await Promise.all(
        entries.slice(i, i + 10).map(async ({ item, remarks }) => {
          const { error } = await supabaseClient
            .from('assets')
            .update({
              is_missing: true,
              missing_date: countDate,
              missing_last_holder: item.issuedTo || null,
              missing_remarks: remarks || null,
              missing_marked_by: email,
              missing_marked_at: nowIso,
            })
            .eq('id', item.id);
          if (error) {
            console.error('Mark-missing error for', item.id, error);
            failed.push({ id: item.id, message: error.message });
            return;
          }
          ok.push(item.id);
          await logAssetEvent(
            item.id,
            'Asset Marked Missing',
            item.name,
            `Not found during physical count ${countDate}` +
              (item.issuedTo ? `; last holder: ${item.issuedTo}` : '') +
              (remarks ? `; ${remarks}` : '')
          );
        })
      );
    }
    return { ok, failed };
  }

  // ===================================================================
  // MISSING ITEMS screen (Settings menu)
  // ===================================================================
  function ensureMissingModal() {
    if (el('missingItemsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'missingItemsModal';
    modal.className = 'modal-backdrop no-print';
    modal.innerHTML = `
      <div class="modal-box modal-box-wide">
        <h3>🔍 Missing Items</h3>
        <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
          Items that were <strong>not found during a physical count</strong>. They are left out of the
          dashboard and of future counts. If an item turns up, mark it <strong>Found</strong> to bring it back.
          If it is gone for good, <strong>Write-off</strong> disposes it as "Lost / Stolen".
        </p>
        <div class="count-entry-scroll">
          <table class="count-entry-table">
            <thead><tr>
              <th>INNOV-ID</th><th>NAME</th><th>CATEGORY</th><th>BRANCH</th><th>LAST HOLDER</th>
              <th>NOT FOUND ON</th><th>REMARKS</th><th>MARKED BY</th><th>ACTION</th>
            </tr></thead>
            <tbody id="missingItemsTableBody"></tbody>
          </table>
        </div>
        <div class="modal-actions">
          <button type="button" id="missingCloseBtn" class="action-btn" style="background:#e2e8f0; color:#334155;">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    el('missingCloseBtn').addEventListener('click', closeMissingItemsModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeMissingItemsModal(); });
  }

  function closeMissingItemsModal() {
    const m = el('missingItemsModal');
    if (m) m.style.display = 'none';
  }

  async function renderMissingItemsTable() {
    const tbody = el('missingItemsTableBody');
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">Loading…</td></tr>';
    missingRows = await fetchMissingAssetRows();
    if (missingRows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">No missing items. 🎉</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    missingRows.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace;">${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td style="font-size:11px; color:#64748b;">${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.branch || 'NAGA')}</td>
        <td>${escapeHtml(item.missingLastHolder || '---')}</td>
        <td>${escapeHtml(item.missingDate || '---')}</td>
        <td style="font-size:12px;">${escapeHtml(item.missingRemarks || '---')}</td>
        <td style="font-size:12px;">${escapeHtml(item.missingMarkedBy || '---')}</td>
        <td style="white-space:nowrap;">
          <button data-found="${escapeHtml(item.id)}" class="btn-table btn-edit-rem">✅ Found</button>
          <button data-writeoff="${escapeHtml(item.id)}" class="btn-table" style="background:#fee2e2; color:#b91c1c;">📦 Write-off</button>
        </td>`;
      tr.querySelector('button[data-found]').addEventListener('click', (e) =>
        markAssetFound(e.currentTarget.dataset.found)
      );
      tr.querySelector('button[data-writeoff]').addEventListener('click', (e) =>
        writeOffMissingAsset(e.currentTarget.dataset.writeoff)
      );
      tbody.appendChild(tr);
    });
  }

  async function openMissingItemsModal() {
    if (!canManage()) return;
    ensureMissingModal();
    el('missingItemsModal').style.display = 'flex';
    await renderMissingItemsTable();
  }

  async function markAssetFound(assetId) {
    if (!canManage()) return;
    const row = missingRows.find((r) => r.id === assetId);
    const confirmed = await showConfirm(
      `Mark ${assetId}${row ? ' — ' + row.name : ''} as FOUND?\n\nIt will return to the dashboard and to future physical counts.`,
      { title: '✅ Item Found', confirmLabel: 'Mark Found', confirmColor: '#0f9d58' }
    );
    if (!confirmed) return;
    const { error } = await supabaseClient
      .from('assets')
      .update({
        is_missing: false,
        missing_date: null,
        missing_last_holder: null,
        missing_remarks: null,
        missing_marked_by: null,
        missing_marked_at: null,
      })
      .eq('id', assetId);
    if (error) {
      console.error('Mark-found error:', error);
      return alert('Failed to mark as found:\n\n' + error.message);
    }
    await logAssetEvent(assetId, 'Asset Found', '(missing)', row ? row.name : '');
    await renderMissingItemsTable();
    if (typeof searchAssets === 'function') searchAssets();
  }

  function writeOffMissingAsset(assetId) {
    const row = missingRows.find((r) => r.id === assetId);
    disposeAssetRecord(assetId, {
      presetReason: 'LOST / STOLEN',
      name: row ? row.name : '',
      onDone: renderMissingItemsTable,
    });
  }

  // Adds "🔍 Missing Items" under Settings (Admin/Accounting only).
  document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('settingsMenu');
    if (!menu || !canManage()) return;
    const link = document.createElement('a');
    link.href = '#';
    link.id = 'missingItemsMenuLink';
    link.textContent = '🔍 Missing Items';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof closeSettingsMenu === 'function') closeSettingsMenu();
      openMissingItemsModal();
    });
    const anchor = document.getElementById('deletedItemsMenuLink');
    menu.insertBefore(link, anchor ? anchor.nextSibling : menu.children[1] || null);
  });

  window.DISPOSAL_REASONS = DISPOSAL_REASONS;
  window.disposeAssetRecord = disposeAssetRecord;
  window.markAssetsMissingFromCount = markAssetsMissingFromCount;
  window.openMissingItemsModal = openMissingItemsModal;
})();
