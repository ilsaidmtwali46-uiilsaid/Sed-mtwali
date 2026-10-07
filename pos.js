/* ==========================================================================
   Omni Business Suite - Point of Sale (POS) Engine
   المستودع: Sed-mtwali
   الملف: js/pos.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // انتظار تهيئة قاعدة البيانات ثم تشغيل محرك المبيعات
  setTimeout(() => {
    POSEngine.init();
  }, 200);
});

const POSEngine = {
  cart: [],
  allProducts: [],

  // 1. التهيئة وربط الأحداث
  async init() {
    await this.loadProducts();
    this.setupEventListeners();
    this.setupShortcuts();
  },

  // 2. تحميل المنتجات وإعداد الأقسام
  async loadProducts() {
    try {
      this.allProducts = await DBEngine.getAll('products');
      this.renderCategoryTabs();
      this.renderProductsGrid(this.allProducts);
    } catch (err) {
      console.error('خطأ في تحميل المنتجات لشاشة المبيعات:', err);
    }
  },

  // 3. بناء تبويبات التصنيفات
  renderCategoryTabs() {
    const tabsContainer = document.getElementById('categoryTabs');
    if (!tabsContainer) return;

    const categories = ['الكل', ...new Set(this.allProducts.map(p => p.category || 'عام'))];
    
    tabsContainer.innerHTML = categories.map((cat, idx) => `
      <button type="button" class="cat-btn ${idx === 0 ? 'active' : ''}" data-cat="${cat}">${cat}</button>
    `).join('');

    tabsContainer.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabsContainer.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const selectedCat = e.target.getAttribute('data-cat');
        this.filterProducts(selectedCat);
      });
    });
  },

  // 4. تصفية وعرض كروت الأصناف
  filterProducts(category) {
    if (category === 'الكل') {
      this.renderProductsGrid(this.allProducts);
    } else {
      const filtered = this.allProducts.filter(p => p.category === category);
      this.renderProductsGrid(filtered);
    }
  },

  renderProductsGrid(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    if (products.length === 0) {
      grid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: var(--text-muted); padding: 20px;">لا توجد أصناف للعرض.</p>';
      return;
    }

    grid.innerHTML = products.map(product => `
      <div class="product-card" data-id="${product.id}">
        <div class="p-name">${product.name}</div>
        <div class="p-price">${Number(product.sellPrice).toFixed(2)} ج.م</div>
      </div>
    `).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const productId = Number(card.getAttribute('data-id'));
        this.addToCartById(productId);
      });
    });
  },

  // 5. إضافة صنف للسلة
  addToCartById(productId) {
    const product = this.allProducts.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
      alert(`⚠️ الصنف [ ${product.name} ] غير متوفر في المخزن!`);
      return;
    }

    const existingIndex = this.cart.findIndex(item => item.productId === productId);
    if (existingIndex > -1) {
      if (this.cart[existingIndex].qty + 1 > product.stock) {
        alert(`⚠️ تجاوزت الكمية المتاحة بالمخزن (${product.stock})!`);
        return;
      }
      this.cart[existingIndex].qty += 1;
      this.cart[existingIndex].total = this.cart[existingIndex].qty * this.cart[existingIndex].price;
    } else {
      this.cart.push({
        productId: product.id,
        name: product.name,
        price: Number(product.sellPrice),
        qty: 1,
        total: Number(product.sellPrice)
      });
    }

    this.renderCart();
  },

  // 6. عرض تحديثات الفاتورة وتفاصيلها
  renderCart() {
    const cartBody = document.getElementById('cartItemsBody');
    const itemsCountEl = document.getElementById('cartTotalItemsCount');
    const grandTotalEl = document.getElementById('cartGrandTotal');

    if (!cartBody) return;

    if (this.cart.length === 0) {
      cartBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:var(--text-muted); padding:20px;">الفاتورة فارغة</td></tr>';
      if (itemsCountEl) itemsCountEl.innerText = '0';
      if (grandTotalEl) grandTotalEl.innerText = '0.00';
      return;
    }

    cartBody.innerHTML = this.cart.map((item, index) => `
      <tr>
        <td>${item.name}</td>
        <td>
          <input type="number" class="qty-input" min="1" value="${item.qty}" data-index="${index}" style="width: 50px; text-align: center; background: var(--bg-dark); border: 1px solid var(--border-color); color: #fff; border-radius: 4px;">
        </td>
        <td>${item.price.toFixed(2)}</td>
        <td>${item.total.toFixed(2)}</td>
        <td>
          <button type="button" class="btn-danger-sm remove-item-btn" data-index="${index}">×</button>
        </td>
      </tr>
    `).join('');

    // تحديث الإجماليات
    const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const grandTotal = this.cart.reduce((sum, item) => sum + item.total, 0);

    if (itemsCountEl) itemsCountEl.innerText = totalItems;
    if (grandTotalEl) grandTotalEl.innerText = grandTotal.toFixed(2);

    // ربط تغيير الكميات والحذف
    cartBody.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        const newQty = parseInt(e.target.value) || 1;
        this.updateItemQty(idx, newQty);
      });
    });

    cartBody.querySelectorAll('.remove-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.target.getAttribute('data-index'));
        this.removeFromCart(idx);
      });
    });
  },

  updateItemQty(index, qty) {
    if (index < 0 || index >= this.cart.length) return;
    const item = this.cart[index];
    const product = this.allProducts.find(p => p.id === item.productId);

    if (product && qty > product.stock) {
      alert(`⚠️ المتاح في المخزن فقط ${product.stock} قطعة.`);
      item.qty = product.stock;
    } else {
      item.qty = qty > 0 ? qty : 1;
    }

    item.total = item.qty * item.price;
    this.renderCart();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.renderCart();
  },

  emptyCart() {
    if (this.cart.length === 0) return;
    if (confirm('هل أنت تأكيد من إلغاء وتفريغ الفاتورة الحالية؟')) {
      this.cart = [];
      this.renderCart();
    }
  },

  // 7. معالجة البحث ومسح الباركود
  setupEventListeners() {
    const searchInput = document.getElementById('posSearchInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    const emptyBtn = document.getElementById('emptyCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (query === '') {
          this.renderProductsGrid(this.allProducts);
          return;
        }

        const matches = this.allProducts.filter(p =>
          p.name.toLowerCase().includes(query) || (p.barcode && p.barcode.includes(query))
        );
        this.renderProductsGrid(matches);
      });

      // عند الضغط على Enter في الباركود يتم إضافة أول صنف مطابق فوراً
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = searchInput.value.trim();
          if (!query) return;

          const exactMatch = this.allProducts.find(p => p.barcode === query || p.name.toLowerCase() === query.toLowerCase());
          if (exactMatch) {
            this.addToCartById(exactMatch.id);
            searchInput.value = '';
            this.renderProductsGrid(this.allProducts);
          } else if (this.allProducts.length > 0) {
            const matches = this.allProducts.filter(p =>
              p.name.toLowerCase().includes(query.toLowerCase()) || (p.barcode && p.barcode.includes(query))
            );
            if (matches.length === 1) {
              this.addToCartById(matches[0].id);
              searchInput.value = '';
              this.renderProductsGrid(this.allProducts);
            }
          }
        }
      });
    }

    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.renderProductsGrid(this.allProducts);
        searchInput.focus();
      });
    }

    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => this.emptyCart());
    }

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.checkout());
    }
  },

  // 8. إغلاق واعتتماد الفاتورة (Checkout & Print)
  async checkout() {
    if (this.cart.length === 0) {
      alert('⚠️ الفاتورة فارغة! أضف أصنافاً أولاً.');
      return;
    }

    const payMethodEl = document.querySelector('input[name="payMethod"]:checked');
    const payMethod = payMethodEl ? payMethodEl.value : 'cash';
    const grandTotal = this.cart.reduce((sum, item) => sum + item.total, 0);

    const saleRecord = {
      timestamp: new Date().toISOString(),
      dateStr: new Date().toLocaleDateString('ar-EG'),
      timeStr: new Date().toLocaleTimeString('ar-EG'),
      items: [...this.cart],
      totalAmount: grandTotal,
      paymentMethod: payMethod
    };

    try {
      // أ. حفظ المبيعات في قاعدة البيانات
      const saleId = await DBEngine.add('sales', saleRecord);

      // ب. خصم الكميات من المخزن تلقائياً
      for (const item of this.cart) {
        const product = this.allProducts.find(p => p.id === item.productId);
        if (product) {
          product.stock -= item.qty;
          await DBEngine.update('products', product);
        }
      }

      // ج. ترحيل الرصيد الخزنة إن كانت كاش تلقائياً
      if (payMethod === 'cash') {
        await DBEngine.add('cashbox', {
          timestamp: new Date().toISOString(),
          type: 'in',
          category: 'مبيعات فاتورة',
          details: `فاتورة مبيعات كاش #${saleId}`,
          amount: grandTotal,
          user: 'الكاشير'
        });
      }

      // د. تجهيز وطباعة الإيصال الحراري
      this.printThermalReceipt(saleId, saleRecord);

      // هـ. تحديث الشاشة وتفريغ السلة
      alert('✅ تم اعتماد الفاتورة وتحديث المخزن والخزنة بنجاح!');
      this.cart = [];
      this.renderCart();
      await this.loadProducts();

      // تحديث واجهة المخزن والخزنة إن كانا معروضين
      if (window.InventoryEngine) window.InventoryEngine.loadInventoryData();
      if (window.CashboxEngine) window.CashboxEngine.loadCashboxData();

    } catch (err) {
      console.error('خطأ أثناء إغلاق الفاتورة:', err);
      alert('❌ حدث خطأ أثناء حظر أو حفظ الفاتورة.');
    }
  },

  // 9. طباعة الفاتورة الحرارية
  printThermalReceipt(saleId, saleRecord) {
    const receiptDate = document.getElementById('receiptDate');
    const receiptNum = document.getElementById('receiptNum');
    const receiptBody = document.getElementById('receiptItemsBody');
    const receiptTotal = document.getElementById('receiptTotalAmount');

    if (receiptDate) receiptDate.innerText = `التاريخ: ${saleRecord.dateStr} ${saleRecord.timeStr}`;
    if (receiptNum) receiptNum.innerText = `رقم الفاتورة: #${saleId}`;
    if (receiptTotal) receiptTotal.innerText = `${saleRecord.totalAmount.toFixed(2)} ج.م`;

    if (receiptBody) {
      receiptBody.innerHTML = saleRecord.items.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.qty}</td>
          <td>${item.price.toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // تشغيل أمر الطباعة
    window.print();
  },

  // 10. دعم اختصارات لوحة المفاتيح (مثل F2 للإنهاء)
  setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.checkout();
      }
    });
  }
};

window.POSEngine = POSEngine;
