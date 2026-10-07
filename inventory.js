/* ==========================================================================
   Omni Business Suite - Inventory & Stock Management Engine
   المستودع: Sed-mtwali
   الملف: js/inventory.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    InventoryEngine.init();
  }, 300);
});

const InventoryEngine = {
  products: [],

  // 1. التهيئة ورصد الأحداث
  async init() {
    await this.loadInventoryData();
    this.setupEventListeners();
  },

  // 2. تحميل البيانات من قاعدة البيانات وحساب الإحصائيات
  async loadInventoryData() {
    try {
      this.products = await DBEngine.getAll('products');
      this.renderInventoryTable(this.products);
      this.updateInventorySummary();
    } catch (err) {
      console.error('خطأ في تحميل بيانات المخزن:', err);
    }
  },

  // 3. عرض جدول المنتجات في الواجهة
  renderInventoryTable(items) {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="color: var(--text-muted); padding: 20px;">
            لا توجد أصناف مسجلة في المخزن حتى الآن.
          </td>
        </tr>`;
      return;
    }

    tableBody.innerHTML = items.map(product => {
      const minStock = product.minStock || 5;
      const isLowStock = product.stock <= minStock;
      const isOutOfStock = product.stock <= 0;

      let statusBadge = `<span class="badge bg-success">متوفر</span>`;
      if (isOutOfStock) {
        statusBadge = `<span class="badge bg-danger">نفذت الكمية</span>`;
      } else if (isLowStock) {
        statusBadge = `<span class="badge bg-warning text-dark">شبه منتهي</span>`;
      }

      return `
        <tr>
          <td><code>${product.barcode || '—'}</code></td>
          <td><strong>${product.name}</strong></td>
          <td><span class="category-tag">${product.category || 'عام'}</span></td>
          <td>${Number(product.buyPrice || 0).toFixed(2)} ج.م</td>
          <td>${Number(product.sellPrice || 0).toFixed(2)} ج.م</td>
          <td class="${isLowStock ? 'text-danger font-bold' : ''}">${product.stock}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="btn-action edit-btn" onclick="InventoryEngine.openEditModal(${product.id})">تعديل</button>
            <button class="btn-action delete-btn" onclick="InventoryEngine.deleteProduct(${product.id})">حذف</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 4. حساب وتحديث الإحصائيات المالية للمخزن
  updateInventorySummary() {
    const totalItemsEl = document.getElementById('invTotalItems');
    const totalCostValueEl = document.getElementById('invTotalCostValue');
    const totalSaleValueEl = document.getElementById('invTotalSaleValue');
    const lowStockCountEl = document.getElementById('invLowStockCount');

    const totalTypes = this.products.length;
    let totalCost = 0;
    let totalSale = 0;
    let lowStockCount = 0;

    this.products.forEach(p => {
      const qty = Number(p.stock) || 0;
      totalCost += (Number(p.buyPrice) || 0) * qty;
      totalSale += (Number(p.sellPrice) || 0) * qty;

      const minStock = p.minStock || 5;
      if (qty <= minStock) lowStockCount++;
    });

    if (totalItemsEl) totalItemsEl.innerText = totalTypes;
    if (totalCostValueEl) totalCostValueEl.innerText = totalCost.toFixed(2) + ' ج.م';
    if (totalSaleValueEl) totalSaleValueEl.innerText = totalSale.toFixed(2) + ' ج.م';
    if (lowStockCountEl) lowStockCountEl.innerText = lowStockCount;
  },

  // 5. إعداد الأحداث للبحث والإنشاء
  setupEventListeners() {
    const searchInput = document.getElementById('invSearchInput');
    const categoryFilter = document.getElementById('invCategoryFilter');
    const productForm = document.getElementById('productForm');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterData());
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.filterData());
    }

    if (productForm) {
      productForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProductForm();
      });
    }
  },

  // 6. الفلترة المباشرة
  filterData() {
    const searchVal = (document.getElementById('invSearchInput')?.value || '').trim().toLowerCase();
    const catVal = document.getElementById('invCategoryFilter')?.value || 'ALL';

    const filtered = this.products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchVal) || (p.barcode && p.barcode.includes(searchVal));
      const matchCat = (catVal === 'ALL') || (p.category === catVal);
      return matchSearch && matchCat;
    });

    this.renderInventoryTable(filtered);
  },

  // 7. حفظ / تعديل منتج
  async saveProductForm() {
    const idInput = document.getElementById('prodId');
    const nameInput = document.getElementById('prodName');
    const barcodeInput = document.getElementById('prodBarcode');
    const categoryInput = document.getElementById('prodCategory');
    const buyPriceInput = document.getElementById('prodBuyPrice');
    const sellPriceInput = document.getElementById('prodSellPrice');
    const stockInput = document.getElementById('prodStock');
    const minStockInput = document.getElementById('prodMinStock');

    if (!nameInput.value.trim() || !sellPriceInput.value) {
      alert('⚠️ يرجى إدخال اسم الصنف وسعر البيع على الأقل.');
      return;
    }

    const productData = {
      name: nameInput.value.trim(),
      barcode: barcodeInput.value.trim(),
      category: categoryInput.value.trim() || 'عام',
      buyPrice: parseFloat(buyPriceInput.value) || 0,
      sellPrice: parseFloat(sellPriceInput.value) || 0,
      stock: parseInt(stockInput.value) || 0,
      minStock: parseInt(minStockInput.value) || 5
    };

    try {
      if (idInput && idInput.value) {
        // تعديل صنف قائم
        productData.id = Number(idInput.value);
        await DBEngine.update('products', productData);
        alert('✅ تم تعديل بيانات الصنف بنجاح!');
      } else {
        // إضافة صنف جديد
        await DBEngine.add('products', productData);
        alert('✅ تم إدخال الصنف الجديد للمخزن بنجاح!');
      }

      this.resetProductForm();
      await this.loadInventoryData();

      // تحديث شاشة POS إن كانت محملة
      if (window.POSEngine) window.POSEngine.loadProducts();

    } catch (err) {
      console.error('خطأ أثناء حفظ الصنف:', err);
      alert('❌ حدث خطأ أثناء حفظ البيانات.');
    }
  },

  // 8. فتح التعديل ومسح النموذج
  openEditModal(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('prodId').value = product.id;
    document.getElementById('prodName').value = product.name;
    document.getElementById('prodBarcode').value = product.barcode || '';
    document.getElementById('prodCategory').value = product.category || 'عام';
    document.getElementById('prodBuyPrice').value = product.buyPrice;
    document.getElementById('prodSellPrice').value = product.sellPrice;
    document.getElementById('prodStock').value = product.stock;
    document.getElementById('prodMinStock').value = product.minStock || 5;

    const modalTitle = document.getElementById('productModalTitle');
    if (modalTitle) modalTitle.innerText = 'تعديل بيانات صنف';
  },

  resetProductForm() {
    const form = document.getElementById('productForm');
    if (form) form.reset();
    const idInput = document.getElementById('prodId');
    if (idInput) idInput.value = '';
    const modalTitle = document.getElementById('productModalTitle');
    if (modalTitle) modalTitle.innerText = 'إضافة صنف جديد للمخزن';
  },

  // 9. حذف صنف
  async deleteProduct(productId) {
    if (!confirm('هل أنت تأكيد من حذف هذا الصنف نهائياً من المخزن؟')) return;

    try {
      await DBEngine.delete('products', productId);
      alert('🗑️ تم حذف الصنف بنجاح.');
      await this.loadInventoryData();
      if (window.POSEngine) window.POSEngine.loadProducts();
    } catch (err) {
      console.error('خطأ في حذف الصنف:', err);
      alert('❌ فشل حذف الصنف.');
    }
  }
};

window.InventoryEngine = InventoryEngine;
