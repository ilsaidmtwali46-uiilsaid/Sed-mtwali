/* ==========================================================================
   Omni Business Suite - Offline IndexedDB Database Engine
   المستودع: Sed-mtwali
   الملف: js/db.js
   ========================================================================== */

const DBEngine = {
  dbName: 'OmniPOSDB',
  dbVersion: 1,
  db: null,

  // 1. تهيئة وقراءة قاعدة البيانات المحلية
  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // مخزن الأصناف والمنتجات
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          productStore.createIndex('barcode', 'barcode', { unique: false });
        }

        // مخزن فواتير المبيعات
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          salesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // مخزن حركة الخزنة والدرج
        if (!db.objectStoreNames.contains('cashbox')) {
          const cashStore = db.createObjectStore('cashbox', { keyPath: 'id', autoIncrement: true });
          cashStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        this.seedInitialProducts();
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB Error:', e.target.error);
        reject(e.target.error);
      };
    });
  },

  // 2. إدخال أصناف تجريبية أولية في حال كانت القاعدة فارغة
  async seedInitialProducts() {
    const products = await this.getAll('products');
    if (products.length === 0) {
      const defaultProducts = [
        { barcode: '1001', name: 'أرز فاخر 1 كجم', buyPrice: 28, sellPrice: 35, stock: 50, category: 'مواد غذائية' },
        { barcode: '1002', name: 'زيت عباد الشمس 1 لتر', buyPrice: 60, sellPrice: 72, stock: 30, category: 'زيوت' },
        { barcode: '1003', name: 'سكر ناعم 1 كجم', buyPrice: 25, sellPrice: 30, stock: 40, category: 'مواد غذائية' },
        { barcode: '1004', name: 'مياه معدنية 1.5 لتر', buyPrice: 5, sellPrice: 8, stock: 100, category: 'مشروبات' }
      ];

      for (const item of defaultProducts) {
        await this.add('products', item);
      }
    }
  },

  // 3. عمليات جلب واسترجاع البيانات العامة (CRUD)
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  add(storeName, item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  update(storeName, item) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // 4. تصدير كافة البيانات كملف نسبي للعميل (JSON Backup) لضمان الخصوصية
  async exportBackupData() {
    const backupObj = {
      version: this.dbVersion,
      exportDate: new Date().toISOString(),
      products: await this.getAll('products'),
      sales: await this.getAll('sales'),
      cashbox: await this.getAll('cashbox')
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `pos_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  // 5. استعادة البيانات من ملف نسخة احتياطية
  async importBackupData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (!data.products || !data.sales || !data.cashbox) {
        throw new Error("ملف النسخة الاحتياطية غير صالح.");
      }

      // تفريغ الجداول القديمة وتنزيل البيانات الجديدة
      const stores = ['products', 'sales', 'cashbox'];
      for (const storeName of stores) {
        const tx = this.db.transaction(storeName, 'readwrite');
        await tx.objectStore(storeName).clear();
      }

      for (const item of data.products) await this.add('products', item);
      for (const item of data.sales) await this.add('sales', item);
      for (const item of data.cashbox) await this.add('cashbox', item);

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
};

// تهيئة قاعدة البيانات تلقائياً عند تحميل الملف
DBEngine.init();
