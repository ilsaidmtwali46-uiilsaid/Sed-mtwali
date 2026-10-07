/* ==========================================================================
   Omni Business Suite - App Controller, Dashboard & Reports Engine
   المستودع: Sed-mtwali
   الملف: js/app.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  AppController.init();
});

const AppController = {
  // 1. التهيئة العامة للتطبيق
  async init() {
    this.setupNavigation();
    this.setupThemeToggle();
    this.setupBackupRestore();
    this.registerServiceWorker();

    // تحميل إحصائيات لوحة التحكم بعد استقرار الاتصال بـ IndexedDB
    setTimeout(() => {
      this.refreshDashboard();
      this.setupReportsEngine();
    }, 500);
  },

  // 2. إدارة التنقل بين الصفحات والتبويبات (SPA Navigation)
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link[data-target]');
    const viewSections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('data-target');

        // تحديث التحديد على القائمة Side-Nav
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // إظهار الشاشة المطلوبة وإخفاء باقي الشاشات
        viewSections.forEach(section => {
          if (section.id === targetId) {
            section.classList.add('active');
            section.style.display = 'block';
          } else {
            section.classList.remove('active');
            section.style.display = 'none';
          }
        });

        // إعادة تنشيط المحركات حسب الشاشة المعروضة
        if (targetId === 'dashboardView') this.refreshDashboard();
        if (targetId === 'posView' && window.POSEngine) window.POSEngine.loadProducts();
        if (targetId === 'inventoryView' && window.InventoryEngine) window.InventoryEngine.loadInventoryData();
        if (targetId === 'cashboxView' && window.CashboxEngine) window.CashboxEngine.loadCashboxData();
      });
    });
  },

  // 3. لوحة التحكم والإحصائيات الشاملة (Dashboard)
  async refreshDashboard() {
    try {
      const sales = await DBEngine.getAll('sales');
      const products = await DBEngine.getAll('products');
      const cashTransactions = await DBEngine.getAll('cashbox');

      const todayStr = new Date().toLocaleDateString('ar-EG');

      // مبيعات اليوم
      const todaySales = sales.filter(s => s.dateStr === todayStr);
      const todaySalesTotal = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

      // حساب أرباح اليوم التقديرية (الفرق بين سعر البيع وسعر الشراء للأصناف المبيعة)
      let todayProfit = 0;
      todaySales.forEach(sale => {
        sale.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const buyPrice = prod ? Number(prod.buyPrice || 0) : 0;
          const itemProfit = (Number(item.price) - buyPrice) * Number(item.qty);
          todayProfit += itemProfit;
        });
      });

      // الرصيد الحالي للفرع
      let totalIn = 0;
      let totalOut = 0;
      cashTransactions.forEach(tx => {
        if (tx.type === 'in') totalIn += Number(tx.amount || 0);
        if (tx.type === 'out') totalOut += Number(tx.amount || 0);
      });
      const netCash = totalIn - totalOut;

      // نواقص المخزن
      const lowStockProducts = products.filter(p => Number(p.stock) <= (p.minStock || 5));

      // تحديث عناصر الواجهة
      const dashSalesEl = document.getElementById('dashTodaySales');
      const dashProfitEl = document.getElementById('dashTodayProfit');
      const dashCashEl = document.getElementById('dashNetCash');
      const dashLowStockEl = document.getElementById('dashLowStockCount');

      if (dashSalesEl) dashSalesEl.innerText = todaySalesTotal.toFixed(2) + ' ج.م';
      if (dashProfitEl) dashProfitEl.innerText = todayProfit.toFixed(2) + ' ج.م';
      if (dashCashEl) dashCashEl.innerText = netCash.toFixed(2) + ' ج.م';
      if (dashLowStockEl) dashLowStockEl.innerText = lowStockProducts.length;

      // عرض أحدث المبيعات في الجدول المصغر
      this.renderRecentSales(sales.slice(-5).reverse());

    } catch (err) {
      console.error('خطأ في تحديث بيانات لوحة التحكم:', err);
    }
  },

  renderRecentSales(recentSales) {
    const body = document.getElementById('recentSalesTableBody');
    if (!body) return;

    if (recentSales.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="text-center" style="color:var(--text-muted);">لا توجد مبيعات مسجلة مؤخراً</td></tr>';
      return;
    }

    body.innerHTML = recentSales.map(sale => `
      <tr>
        <td>#${sale.id || '—'}</td>
        <td><small>${sale.timeStr || sale.dateStr}</small></td>
        <td>${sale.items ? sale.items.length : 0} أصناف</td>
        <td><strong>${Number(sale.totalAmount).toFixed(2)} ج.م</strong></td>
      </tr>
    `).join('');
  },

  // 4. محرك التقارير التفصيلية
  setupReportsEngine() {
    const filterBtn = document.getElementById('generateReportBtn');
    if (filterBtn) {
      filterBtn.addEventListener('click', () => this.generateReports());
    }
  },

  async generateReports() {
    const startDateVal = document.getElementById('reportStartDate')?.value;
    const endDateVal = document.getElementById('reportEndDate')?.value;

    try {
      const sales = await DBEngine.getAll('sales');
      const products = await DBEngine.getAll('products');

      let filteredSales = sales;

      if (startDateVal) {
        const start = new Date(startDateVal);
        filteredSales = filteredSales.filter(s => new Date(s.timestamp) >= start);
      }

      if (endDateVal) {
        const end = new Date(endDateVal);
        end.setHours(23, 59, 59, 999);
        filteredSales = filteredSales.filter(s => new Date(s.timestamp) <= end);
      }

      // إحصائيات التقرير
      const totalSalesAmount = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      
      let totalCostAmount = 0;
      filteredSales.forEach(sale => {
        sale.items.forEach(item => {
          const prod = products.find(p => p.id === item.productId);
          const buyPrice = prod ? Number(prod.buyPrice || 0) : 0;
          totalCostAmount += buyPrice * Number(item.qty);
        });
      });

      const totalProfit = totalSalesAmount - totalCostAmount;

      // تحديث نتائج التقرير
      const repTotalSales = document.getElementById('repTotalSales');
      const repTotalCost = document.getElementById('repTotalCost');
      const repTotalProfit = document.getElementById('repTotalProfit');
      const repCount = document.getElementById('repInvoicesCount');

      if (repTotalSales) repTotalSales.innerText = totalSalesAmount.toFixed(2) + ' ج.م';
      if (repTotalCost) repTotalCost.innerText = totalCostAmount.toFixed(2) + ' ج.م';
      if (repTotalProfit) repTotalProfit.innerText = totalProfit.toFixed(2) + ' ج.م';
      if (repCount) repCount.innerText = filteredSales.length;

      // ملء جدول فواتير التقرير
      const repBody = document.getElementById('reportTableBody');
      if (repBody) {
        if (filteredSales.length === 0) {
          repBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--text-muted);">لا توجد فواتير مطابقة للفترة المحددة</td></tr>';
        } else {
          repBody.innerHTML = filteredSales.map(s => `
            <tr>
              <td>#${s.id}</td>
              <td>${s.dateStr} ${s.timeStr}</td>
              <td>${s.paymentMethod === 'cash' ? 'كاش' : 'آجل / خيارات أخرى'}</td>
              <td>${s.items.length} صنف</td>
              <td><strong>${Number(s.totalAmount).toFixed(2)} ج.م</strong></td>
            </tr>
          `).join('');
        }
      }

    } catch (err) {
      console.error('خطأ في استخراج التقارير:', err);
      alert('❌ فشل استخراج البيانات للتقرير.');
    }
  },

  // 5. محرك النسخ الاحتياطي والاستعادة (Backup & Restore)
  setupBackupRestore() {
    const exportBtn = document.getElementById('exportBackupBtn');
    const importInput = document.getElementById('importBackupInput');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBackupJSON());
    }

    if (importInput) {
      importInput.addEventListener('change', (e) => this.importBackupJSON(e));
    }
  },

  async exportBackupJSON() {
    try {
      const backupData = {
        app: 'Omni Business Suite',
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        products: await DBEngine.getAll('products'),
        sales: await DBEngine.getAll('sales'),
        cashbox: await DBEngine.getAll('cashbox')
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `Omni_Backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('💾 تم تصدير النسخة الاحتياطية بنجاح إلى جهازك!');
    } catch (err) {
      console.error('خطأ في إنشاء النسخة الاحتياطية:', err);
      alert('❌ حدث خطأ أثناء التصدير.');
    }
  },

  importBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('⚠️ تحذير: استعادة النسخة الاحتياطية ستدمج وإعادة كتابة البيانات. هل ترغب في الاستمرار؟')) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (data.products && Array.isArray(data.products)) {
          for (const p of data.products) {
            delete p.id;
            await DBEngine.add('products', p);
          }
        }

        if (data.sales && Array.isArray(data.sales)) {
          for (const s of data.sales) {
            delete s.id;
            await DBEngine.add('sales', s);
          }
        }

        if (data.cashbox && Array.isArray(data.cashbox)) {
          for (const c of data.cashbox) {
            delete c.id;
            await DBEngine.add('cashbox', c);
          }
        }

        alert('✅ تم استعادة واستيراد البيانات بنجاح!');
        location.reload();

      } catch (err) {
        console.error('خطأ في استيراد النسخة الاحتياطية:', err);
        alert('❌ صيغة الملف غير صحيحة أو غير مدعومة.');
      }
    };
    reader.readAsText(file);
  },

  // 6. التحكم بالوضع الداكن والفاتح (Theme Toggle)
  setupThemeToggle() {
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('theme_preference', isLight ? 'light' : 'dark');
    });

    const savedTheme = localStorage.getItem('theme_preference');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    }
  },

  // 7. تسجيل الـ Service Worker لضمان عمل PWA أوفلاين
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    }
  }
};

window.AppController = AppController;
