/* ==========================================================================
   Omni Business Suite - Core & Navigation Engine
   المستودع: Sed-mtwali
   الملف: js/app.js
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  AppCore.init();
});

const AppCore = {
  // 1. الإعدادات والبيانات الحالية للنشاط (تمثل محاكاة استلام بيانات الأدمن)
  config: {
    businessName: "سوبر ماركت الأمل", // محدد من قبل الأدمن فقط
    pinCode: "1234",                // رمز الحماية الافتراضي للدخول للأقسام المحمية
    subscriptionStatus: "active",   // حالة الاشتراك: active / expired
    subscriptionExpireDate: "2027-01-01",
    tickerMessage: "أهلاً بكم في نظام المبيعات السريع - خصومات حصرية لجميع العملاء!",
    tickerSpeedSeconds: 15
  },

  targetScreenAfterPin: null, // الشاشة المعلقة بانتظار إدخال الـ PIN

  // 2. دالة البدء والتهيئة
  init() {
    this.applyAdminConfig();
    this.setupNavigation();
    this.setupPinModal();
    this.setupTicker();
  },

  // 3. تطبيق إعدادات الأدمن (اسم النشاط والشريط الدعائي والاشتراك)
  applyAdminConfig() {
    // اسم النشاط (Read-Only)
    const nameDisplay = document.getElementById('businessNameDisplay');
    const receiptNameDisplay = document.getElementById('receiptBusinessName');
    
    if (nameDisplay) nameDisplay.innerText = this.config.businessName;
    if (receiptNameDisplay) receiptNameDisplay.innerText = this.config.businessName;

    // حالة الاشتراك
    const subStatusText = document.getElementById('subStatusText');
    const subDot = document.getElementById('subDot');

    if (this.config.subscriptionStatus === 'active') {
      if (subStatusText) subStatusText.innerText = 'اشتراك ساري';
      if (subDot) subDot.style.backgroundColor = 'var(--success-color)';
    } else {
      if (subStatusText) subStatusText.innerText = 'منتهي - يرجى التجديد';
      if (subDot) subDot.style.backgroundColor = 'var(--danger-color)';
    }
  },

  // 4. ضبط وتنظيم الشريط الدعائي وتكراره لملء الفراغ
  setupTicker() {
    const tickerContent = document.getElementById('tickerContent');
    if (!tickerContent) return;

    let message = this.config.tickerMessage.trim();

    // الشرط 4: إذا كانت الرسالة قصيرة، نقوم بتكرارها لملء المساحة
    if (message.length < 60) {
      message = (message + "   ★   ").repeat(4);
    }

    tickerContent.innerText = message;
    tickerContent.style.animationDuration = `${this.config.tickerSpeedSeconds}s`;
  },

  // 5. نظام التنقل والتحكم بالشاشات
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetScreen = item.getAttribute('data-screen');
        const isProtected = item.getAttribute('data-protected') === 'true';

        if (isProtected) {
          // فتح نافذة طلب الـ PIN للأقسام المحمية
          this.targetScreenAfterPin = targetScreen;
          this.openPinModal();
        } else {
          // الانتقال المباشر (مثل شاشة المبيعات)
          this.switchScreen(targetScreen);
        }
      });
    });
  },

  // دالة تبديل الشاشات
  switchScreen(screenId) {
    // إخفاء كافة الشاشات
    const screens = document.querySelectorAll('.screen-view');
    screens.forEach(screen => screen.classList.remove('active-screen'));

    // تفغيل الشاشة المطلوبة
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active-screen');
    }

    // تحديث الأيقونة النشطة في شريط التنقل
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(nav => {
      if (nav.getAttribute('data-screen') === screenId) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });
  },

  // 6. إدارة نافذة الحماية (PIN Modal)
  setupPinModal() {
    const submitBtn = document.getElementById('submitPinBtn');
    const closeBtn = document.getElementById('closePinModalBtn');
    const pinInput = document.getElementById('pinInput');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.verifyPin());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePinModal());
    }

    if (pinInput) {
      pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.verifyPin();
      });
    }
  },

  openPinModal() {
    const modal = document.getElementById('pinModal');
    const pinInput = document.getElementById('pinInput');
    const errorMsg = document.getElementById('pinErrorMsg');

    if (errorMsg) errorMsg.innerText = '';
    if (pinInput) pinInput.value = '';

    if (modal) {
      modal.classList.add('active');
      setTimeout(() => pinInput.focus(), 150);
    }
  },

  closePinModal() {
    const modal = document.getElementById('pinModal');
    if (modal) modal.classList.remove('active');
    this.targetScreenAfterPin = null;
  },

  verifyPin() {
    const pinInput = document.getElementById('pinInput');
    const errorMsg = document.getElementById('pinErrorMsg');
    const enteredPin = pinInput ? pinInput.value.trim() : '';

    if (enteredPin === this.config.pinCode) {
      // الرمز صحيح -> فتح الشاشة
      const screenToOpen = this.targetScreenAfterPin;
      this.closePinModal();
      if (screenToOpen) {
        this.switchScreen(screenToOpen);
      }
    } else {
      // الرمز خاطئ
      if (errorMsg) errorMsg.innerText = '❌ رمز الحماية غير صحيح!';
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  }
};
