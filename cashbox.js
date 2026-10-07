/* ==========================================================================
   Omni Business Suite - Cashbox & Financial Management Engine
   المستودع: Sed-mtwali
   الملف: js/cashbox.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    CashboxEngine.init();
  }, 400);
});

const CashboxEngine = {
  transactions: [],

  // 1. التهيئة ورصد الأحداث
  async init() {
    await this.loadCashboxData();
    this.setupEventListeners();
  },

  // 2. تحميل كافة المعاملات المالية وتحديث الواجهة
  async loadCashboxData() {
    try {
      this.transactions = await DBEngine.getAll('cashbox');
      // ترتيب المعاملات من أحدث حركة إلى أقدم حركة
      this.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      this.renderCashboxTable(this.transactions);
      this.updateCashboxSummary();
    } catch (err) {
      console.error('خطأ في تحميل بيانات الخزنة:', err);
    }
  },

  // 3. عرض جدول العمليات المالية
  renderCashboxTable(items) {
    const tableBody = document.getElementById('cashboxTableBody');
    if (!tableBody) return;

    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 20px;">
            لا توجد حرّكات مالية مسجلة بالخزنة حتى الآن.
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = items.map(tx => {
      const isIncome = tx.type === 'in';
      const typeBadge = isIncome 
        ? `<span class="badge bg-success">📥 وارد (مقبوضات)</span>`
        : `<span class="badge bg-danger">📤 منصرف (مصروفات)</span>`;

      const amountColor = isIncome ? 'color: var(--success-color);' : 'color: var(--danger-color);';
      const amountPrefix = isIncome ? '+' : '-';

      const dateObj = new Date(tx.timestamp);
      const formattedDate = dateObj.toLocaleDateString('ar-EG') + ' ' + dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td><small style="color:var(--text-muted);">${formattedDate}</small></td>
          <td>${typeBadge}</td>
          <td><span class="category-tag">${tx.category || 'عام'}</span></td>
          <td>${tx.details || '—'}</td>
          <td><strong style="${amountColor}">${amountPrefix}${Number(tx.amount).toFixed(2)} ج.م</strong></td>
          <td>${tx.user || 'المسؤول'}</td>
          <td>
            <button class="btn-action delete-btn" onclick="CashboxEngine.deleteTransaction(${tx.id})">حذف</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 4. حساب وتحديث إحصائيات الخزنة
  updateCashboxSummary() {
    const totalInEl = document.getElementById('cashboxTotalIn');
    const totalOutEl = document.getElementById('cashboxTotalOut');
    const netBalanceEl = document.getElementById('cashboxNetBalance');

    let totalIn = 0;
    let totalOut = 0;

    this.transactions.forEach(tx => {
      const val = Number(tx.amount) || 0;
      if (tx.type === 'in') {
        totalIn += val;
      } else if (tx.type === 'out') {
        totalOut += val;
      }
    });

    const netBalance = totalIn - totalOut;

    if (totalInEl) totalInEl.innerText = totalIn.toFixed(2) + ' ج.م';
    if (totalOutEl) totalOutEl.innerText = totalOut.toFixed(2) + ' ج.م';
    if (netBalanceEl) {
      netBalanceEl.innerText = netBalance.toFixed(2) + ' ج.م';
      netBalanceEl.style.color = netBalance >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    }
  },

  // 5. إعداد الأحداث للنموذج والتصفية
  setupEventListeners() {
    const searchInput = document.getElementById('cashSearchInput');
    const typeFilter = document.getElementById('cashTypeFilter');
    const cashForm = document.getElementById('cashboxForm');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterData());
    }

    if (typeFilter) {
      typeFilter.addEventListener('change', () => this.filterData());
    }

    if (cashForm) {
      cashForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveTransaction();
      });
    }
  },

  // 6. الفلترة السريعة للعمليات
  filterData() {
    const searchVal = (document.getElementById('cashSearchInput')?.value || '').trim().toLowerCase();
    const typeVal = document.getElementById('cashTypeFilter')?.value || 'ALL';

    const filtered = this.transactions.filter(tx => {
      const matchSearch = (tx.details && tx.details.toLowerCase().includes(searchVal)) || 
                          (tx.category && tx.category.toLowerCase().includes(searchVal));
      const matchType = (typeVal === 'ALL') || (tx.type === typeVal);
      return matchSearch && matchType;
    });

    this.renderCashboxTable(filtered);
  },

  // 7. حفظ حركة مالية جديدة (وارد / منصرف)
  async saveTransaction() {
    const typeEl = document.getElementById('cashType');
    const categoryEl = document.getElementById('cashCategory');
    const amountEl = document.getElementById('cashAmount');
    const detailsEl = document.getElementById('cashDetails');

    const type = typeEl ? typeEl.value : 'out';
    const category = categoryEl ? categoryEl.value.trim() : 'عام';
    const amount = parseFloat(amountEl?.value) || 0;
    const details = detailsEl ? detailsEl.value.trim() : '';

    if (amount <= 0) {
      alert('⚠️ يرجى إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    const txRecord = {
      timestamp: new Date().toISOString(),
      type: type,
      category: category || (type === 'in' ? 'إيداع / وارد' : 'مصروفات'),
      details: details || (type === 'in' ? 'حركة إيداع مالية' : 'مصروفات عامة'),
      amount: amount,
      user: 'المسؤول'
    };

    try {
      await DBEngine.add('cashbox', txRecord);
      alert('✅ تم تسجيل الحركة المالية في الخزنة بنجاح!');

      this.resetCashboxForm();
      await this.loadCashboxData();

    } catch (err) {
      console.error('خطأ أثناء حفظ الحركة المالية:', err);
      alert('❌ حدث خطأ أثناء الحفظ.');
    }
  },

  resetCashboxForm() {
    const form = document.getElementById('cashboxForm');
    if (form) form.reset();
  },

  // 8. حذف حركة مالية
  async deleteTransaction(id) {
    if (!confirm('هل أنت تأكيد من حذف هذه الحركة المالية من سجل الخزنة؟')) return;

    try {
      await DBEngine.delete('cashbox', id);
      alert('🗑️ تم حذف الحركة المالية.');
      await this.loadCashboxData();
    } catch (err) {
      console.error('خطأ في حذف العملية:', err);
      alert('❌ فشل حذف الحركة.');
    }
  }
};

window.CashboxEngine = CashboxEngine;
