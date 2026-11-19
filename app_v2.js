/* ========================================================
       GLOBAL STATE & LOCALSTORAGE SOZLAMALARI
       ======================================================== */
    let allGrants = [];
    let filteredGrants = [];
    let displayedCount = 12;
    let favorites = new Set();
    let currentCategory = 'all';
    let currentCountry = 'all';
    let currentDegree = 'all';
    let currentIelts = 'all';
    let currentSearch = '';
    let showOnlySaved = false;

    // Foydalanuvchi ma'lumotlari (3 ta rol)
    // role: 'admin' | 'student_abroad' | 'applicant'
    let currentUser = null;

    // Obuna bo'lganlar (Vatandoshlar va Mentorlar ro'yxati)
    let userSubscriptions = new Set(['cr-javohir', 'cr-madina']); // Boshlang'ich tavsiya sifatida 2 ta mentor

    // Chat tarixi
    let activeChatChannel = 'global';
    let chatHistories = {};

    /* ========================================================
       1. INITIALIZATION ON PAGE LOAD
       ======================================================== */
    window.addEventListener('DOMContentLoaded', () => {
      // 1.1. Grants bazasini yuklash
      if (window.GRANTS_DATABASE && Array.isArray(window.GRANTS_DATABASE)) {
        allGrants = window.GRANTS_DATABASE;
      } else {
        console.warn("window.GRANTS_DATABASE topilmadi, keshdan tekshiriladi...");
      }

      // 1.2. Saqlangan sevimlilarni yuklash
      const savedFavs = localStorage.getItem('gf_favs');
      if (savedFavs) {
        try { favorites = new Set(JSON.parse(savedFavs)); } catch(e){}
      }

      // 1.3. Saqlangan obunalarni yuklash
      const savedSubs = localStorage.getItem('gf_subscriptions');
      if (savedSubs) {
        try { userSubscriptions = new Set(JSON.parse(savedSubs)); } catch(e){}
      }

      // 1.4. Chat tarixini yuklash
      initChatHistories();

      // 1.5. Foydalanuvchi sessiyasini tekshirish
      const savedUser = localStorage.getItem('gf_user');
      if (savedUser) {
        try { currentUser = JSON.parse(savedUser); } catch(e){}
      }

      // Gatekeeper holati
      const gatekeeper = document.getElementById('loginGatekeeper');
      if (!currentUser) {
        if (gatekeeper) gatekeeper.style.display = 'flex';
      } else {
        if (gatekeeper) gatekeeper.style.display = 'none';
        applyUserRoleUI();
      }

      // 1.6. Dastlabki renderlar
      updateCategoryCounts();
      applyFilters();
      renderStories();
      renderChatChannelsList();
      renderChatMessages();
      renderProfileSubscriptions();
    });

    /* ========================================================
       2. SPA VIEW ROUTER (BO'LIMLAR O'RTASIDA ISHONCHLI ALMASHINUV)
       Faqat bitta bo'lim ko'rinadi, pastga tushganda boshqa bo'limlar chiqmaydi!
       ======================================================== */
    function switchView(viewName) {
      // 1. Barcha viewlarni yashirish
      document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));

      // 2. Tanlangan viewni ko'rsatish
      const target = document.getElementById('view-' + viewName);
      if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // 3. Desktop tab tugmalarini yangilash
      document.querySelectorAll('.nav-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
      });

      // 4. Mobil pastki sticky navigationni yangilash
      document.querySelectorAll('.bottom-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
      });

      // 5. Maxsus qayta hisoblashlar
      if (viewName === 'profile') {
        renderProfileSubscriptions();
        renderProfileFavorites();
      }
      if (viewName === 'chat') {
        scrollChatToBottom();
      }
    }

    /* ========================================================
       3. USER ROLES & GATEKEEPER MANAGEMENT
       3 ta rol:
       - admin (hamma narsa ochiq)
       - student_abroad (video yuklash huquqi bor, chatda mentor)
       - applicant (video yuklash yopiq, chat va grantlar ochiq)
       ======================================================== */
    function switchGateTab(tab) {
      document.getElementById('gateLoginForm').style.display = tab === 'login' ? 'block' : 'none';
      document.getElementById('gateRegForm').style.display = tab === 'register' ? 'block' : 'none';
      document.getElementById('gateQuickForm').style.display = tab === 'quick' ? 'block' : 'none';

      document.getElementById('gateTabLogin').classList.toggle('active', tab === 'login');
      document.getElementById('gateTabRegister').classList.toggle('active', tab === 'register');
      document.getElementById('gateTabQuick').classList.toggle('active', tab === 'quick');

      const gk = document.getElementById('loginGatekeeper');
      if (gk) gk.scrollTop = 0;
    }

    function toggleRegFields() {
      const selectedRole = document.querySelector('input[name="regRole"]:checked').value;
      document.getElementById('fieldsStudentAbroad').style.display = selectedRole === 'student_abroad' ? 'block' : 'none';
      document.getElementById('fieldsApplicant').style.display = selectedRole === 'applicant' ? 'block' : 'none';
    }

    function handleGateLogin(e) {
      e.preventDefault();
      const u = document.getElementById('gateLoginUser').value.trim();
      const p = document.getElementById('gateLoginPass').value.trim();

      if (u === 'admin' && p === 'admin') {
        currentUser = {
          name: "Admin",
          role: "admin",
          roleTitle: "Bosh Administrator",
          email: "admin@grantfinder.uz",
          degree: "Magistratura",
          ielts: "7.5",
          univ: "Loyiha Rahbariyati"
        };
      } else {
        const name = u.includes('@') ? u.split('@')[0] : u;
        currentUser = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          role: "applicant",
          roleTitle: "Izlanuvchi / Abituriyent",
          email: u.includes('@') ? u : `${u}@grantfinder.uz`,
          degree: "Bakalavriat",
          ielts: "6.5",
          univ: "Xalqaro OTM Izlanuvchisi"
        };
      }

      saveAndEnter();
    }

    function handleGateRegister(e) {
      e.preventDefault();
      const selectedRole = document.querySelector('input[name="regRole"]:checked').value;
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();

      if (selectedRole === 'student_abroad') {
        const univ = document.getElementById('regUniv').value.trim() || 'AQSH Universiteti';
        const grantName = document.getElementById('regGrantName').value.trim() || '100% Grant';
        const consent = document.getElementById('regShareConsent').checked;

        currentUser = {
          name: name,
          role: "student_abroad",
          roleTitle: "Chet Eldagi Talaba (Mentor)",
          email: email,
          univ: univ,
          grantName: grantName,
          shareConsent: consent,
          degree: "Bakalavr / Magistr",
          ielts: "7.5+"
        };
      } else if (selectedRole === 'admin') {
        currentUser = {
          name: name,
          role: "admin",
          roleTitle: "Bosh Administrator",
          email: email,
          degree: "Magistratura",
          ielts: "7.5",
          univ: "Admin Boshqaruvi"
        };
      } else {
        // applicant
        const goal = document.getElementById('regAppGoal').value.trim() || 'Xalqaro OTM';
        currentUser = {
          name: name,
          role: "applicant",
          roleTitle: "Izlanuvchi / Abituriyent",
          email: email,
          goal: goal,
          degree: "Bakalavriat",
          ielts: "6.5",
          univ: goal
        };
      }

      saveAndEnter();
    }

    function quickLoginRole(role) {
      if (role === 'admin') {
        currentUser = {
          name: "Maftuna Islamova",
          role: "admin",
          roleTitle: "Loyiha Rahbari (Admin)",
          email: "admin@grantfinder.uz",
          degree: "Magistratura",
          ielts: "8.0",
          univ: "Grant Finder Boshqaruv Markazi"
        };
      } else if (role === 'student_abroad') {
        currentUser = {
          name: "Javohir Sindarov",
          role: "student_abroad",
          roleTitle: "MIT Talabasi (Mentor)",
          email: "javohir@mit.edu",
          univ: "Massachusetts Institute of Technology (MIT)",
          grantName: "100% Need-Blind Scholarship ($85,000/yil)",
          degree: "Bakalavriat (Computer Science)",
          ielts: "8.0",
          shareConsent: true
        };
      } else {
        currentUser = {
          name: "Sardorbek Karimov",
          role: "applicant",
          roleTitle: "Izlanuvchi / Abituriyent",
          email: "sardor@gmail.com",
          goal: "AQSH va Germaniya Grantlari",
          degree: "Bakalavriat",
          ielts: "6.5",
          univ: "Xalqaro OTMga Topshiruvchi"
        };
      }

      saveAndEnter();
    }

    function saveAndEnter() {
      localStorage.setItem('gf_user', JSON.stringify(currentUser));
      document.getElementById('loginGatekeeper').style.display = 'none';
      applyUserRoleUI();
      showToast(`Xush kelibsiz, ${currentUser.name}! Siz "${currentUser.roleTitle}" rolidasiz. 🎉`, 'success');
    }

    function applyUserRoleUI() {
      if (!currentUser) return;

      // 1. Header foydalanuvchi ma'lumoti
      const inits = currentUser.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() || 'GF';
      document.getElementById('headerAvatar').textContent = inits;
      document.getElementById('headerUserName').textContent = currentUser.name.split(' ')[0];
      document.getElementById('headerUserRole').textContent = currentUser.roleTitle;

      // 2. Admin navigatsiyasi ko'rsatish/yashirish
      const adminNavTab = document.getElementById('navAdminTab');
      if (adminNavTab) {
        adminNavTab.style.display = currentUser.role === 'admin' ? 'inline-flex' : 'none';
      }

      // 3. Vatandoshlar Tajribasi: VIDEO YUKLASH TUGMASI (TALABA VA ADMIN UCHUN OCHIQ, IZLANUVCHIGA YOPIQ!)
      const uploadActionWrap = document.getElementById('storyUploadActionWrap');
      if (uploadActionWrap) {
        if (currentUser.role === 'student_abroad' || currentUser.role === 'admin') {
          uploadActionWrap.innerHTML = `
            <button class="btn-primary btn-oval" onclick="openUploadStoryModal()" style="padding:12px 24px; font-weight:800; font-size:0.95rem; box-shadow:0 6px 20px rgba(79,70,229,0.35);">
              📹 Tajriba Videosi / Maslahat Yuklash
            </button>
          `;
        } else {
          // Izlanuvchilar uchun video yuklash tugmasi bo'lmaydi!
          uploadActionWrap.innerHTML = `
            <div style="background:var(--surface); border:1.5px solid var(--border); padding:10px 18px; border-radius:var(--radius-full); font-size:0.84rem; color:var(--text-muted); font-weight:700; display:flex; align-items:center; gap:8px;">
              <span>💡</span> Siz izlanuvchisiz: Talabalar tajribasini tomosha qiling va chatda savol bering.
            </div>
          `;
        }
      }

      // 4. Profil sahifasini yangilash
      document.getElementById('profAvatarBig').textContent = inits;
      document.getElementById('profNameBig').textContent = currentUser.name;
      document.getElementById('profEmailBig').textContent = currentUser.email;
      document.getElementById('profRoleBadge').textContent = currentUser.roleTitle;
      document.getElementById('profUnivTag').textContent = "🏛️ " + (currentUser.univ || "Xalqaro OTM");
      document.getElementById('profIeltsTag').textContent = "🌐 IELTS: " + (currentUser.ielts || "Mavjud emas");

      renderProfileSubscriptions();
    }

    function openGatekeeperForRoleChange() {
      document.getElementById('loginGatekeeper').style.display = 'flex';
      switchGateTab('register');
    }

    function logoutUser() {
      localStorage.removeItem('gf_user');
      currentUser = null;
      document.getElementById('loginGatekeeper').style.display = 'flex';
      switchGateTab('login');
      showToast("Tizimdan chiqildi. Yangi hisob bilan kiring.", 'info');
    }

    /* ========================================================
       4. OBUNALAR TIZIMI (SIZ OBUNA BO'LGAN VATANDOSHLAR)
       Foydalanuvchi profilida ko'rinadi va boshqariladi
       ======================================================== */
    function toggleStorySubscribe(creatorId) {
      if (userSubscriptions.has(creatorId)) {
        userSubscriptions.delete(creatorId);
        showToast("Obuna bekor qilindi.", 'info');
      } else {
        userSubscriptions.add(creatorId);
        showToast("Tabriklaymiz! Mentorga muvaffaqiyatli obuna bo'ldingiz. Profilingizda ko'rishingiz mumkin! 🔔", 'success');
      }

      localStorage.setItem('gf_subscriptions', JSON.stringify(Array.from(userSubscriptions)));
      renderStories();
      renderProfileSubscriptions();
    }

    function renderProfileSubscriptions() {
      const container = document.getElementById('profileSubscriptionsList');
      const countLabel = document.getElementById('profileSubCount');
      if (!container) return;

      const subsArray = Array.from(userSubscriptions);
      if (countLabel) countLabel.textContent = subsArray.length;

      if (subsArray.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding:36px 20px; background:var(--surface-subtle); border-radius:24px; border:1px dashed var(--border);">
            <div style="font-size:2.5rem; margin-bottom:8px;">🔔</div>
            <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:6px;">Hozircha hech qaysi mentorga obuna bo'lmadingiz</h4>
            <p style="font-size:0.86rem; color:var(--text-muted); max-width:480px; margin:0 auto 16px auto;">
              "Vatandoshlar Tajribasi" bo'limida dunyo nufuzli OTMlarida o'qiyotgan talabalar videolarini ko'rib, o'zingizga qiziq mentorlarga obuna bo'ling!
            </p>
            <button class="btn-primary btn-oval" onclick="switchView('stories')">
              🎬 Vatandoshlar Videolarini Ko'rish
            </button>
          </div>
        `;
        return;
      }

      let html = '';
      subsArray.forEach(cid => {
        const creator = getCreatorData(cid);
        if (!creator) return;

        html += `
          <div class="sub-channel-card">
            <div style="display:flex; align-items:center; gap:14px;">
              <div class="ch-avatar" style="background:${creator.avatarBg}; width:50px; height:50px; font-size:1.1rem;">
                ${creator.initials}
                <span class="online-dot"></span>
              </div>
              <div>
                <h4 style="font-size:0.98rem; font-weight:800; color:var(--text); margin-bottom:2px;">
                  ${creator.name} ${creator.flag}
                </h4>
                <div style="font-size:0.82rem; color:var(--primary); font-weight:700;">
                  🏛️ ${creator.university}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted);">
                  🏆 ${creator.grant}
                </div>
              </div>
            </div>

            <div class="sub-actions-row">
              <button class="btn-secondary btn-oval" onclick="openChatWithMentor('${creator.id}')" style="padding:8px 16px; font-size:0.82rem;">
                💬 Chatda Savol Berish
              </button>
              <button class="btn-secondary btn-oval" onclick="viewCreatorVideos('${creator.id}')" style="padding:8px 16px; font-size:0.82rem;">
                🎬 Videolari
              </button>
              <button class="icon-btn" onclick="toggleStorySubscribe('${creator.id}')" title="Obunani bekor qilish" style="width:36px; height:36px; font-size:0.9rem; color:#ef4444;">
                ✕
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    function getCreatorData(creatorId) {
      const story = SCHOLAR_STORIES.find(s => s.creatorId === creatorId || s.creator.id === creatorId);
      return story ? story.creator : null;
    }

    function openChatWithMentor(creatorId) {
      switchView('chat');
      selectChatChannel(creatorId);
    }

    function viewCreatorVideos(creatorId) {
      switchView('stories');
      openCreatorProfile(creatorId);
    }

    /* ========================================================
       5. CHAT MESSENGER TIZIMI (TALABALAR VA TOPSHIRUVCHILAR)
       Real vaqtli muloqot va aqlli mentor javoblari simulyatsiyasi
       ======================================================== */
    const CHAT_CHANNELS = [
      {
        id: "global",
        name: "🌍 Barcha Talabalar & Abituriyentlar Forumi",
        role: "Umumiy Savol-Javob Kanali",
        avatarBg: "linear-gradient(135deg, #4f46e5, #06b6d4)",
        initials: "GF",
        online: true
      },
      {
        id: "cr-javohir",
        name: "Javohir Sindarov 🇺🇸",
        role: "MIT Talabasi (AQSH 100% Grant)",
        avatarBg: "linear-gradient(135deg, #10b981, #06b6d4)",
        initials: "JS",
        online: true
      },
      {
        id: "cr-madina",
        name: "Madina Karimova 🇬🇧",
        role: "Oxford Universiteti (Chevening)",
        avatarBg: "linear-gradient(135deg, #8b5cf6, #ec4899)",
        initials: "MK",
        online: true
      },
      {
        id: "cr-bekzod",
        name: "Bekzod Rustamov 🇩🇪",
        role: "TUM Myunxen (DAAD Granti)",
        avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
        initials: "BR",
        online: true
      },
      {
        id: "cr-shahnoza",
        name: "Shahnoza Alimova 🇰🇷",
        role: "Seul Milliy Universiteti (GKS)",
        avatarBg: "linear-gradient(135deg, #f59e0b, #ef4444)",
        initials: "SA",
        online: true
      }
    ];

    function initChatHistories() {
      const saved = localStorage.getItem('gf_chat_histories');
      if (saved) {
        try { chatHistories = JSON.parse(saved); return; } catch(e){}
      }

      // Standart dastlabki xabarlar
      chatHistories = {
        "global": [
          { sender: "Sardorbek", isMe: false, text: "Assalomu alaykum hammaga! AQSH universitetlariga topshirishda inshoni qanday qilib ajralib turadigan qilish mumkin?", time: "11:20" },
          { sender: "Javohir Sindarov (MIT)", isMe: false, text: "Va alaykum assalom! Eng muhimi — shaxsiy hikoya va samimiylik. Common App inshosida boshdan kechirgan qiyinchiliklaringiz va ularni qanday yengganingizni yozing.", time: "11:24" },
          { sender: "Madina Karimova (Oxford)", isMe: false, text: "Shuningdek, har bir universitetning qadriyatlariga qarang. Inshongiz nima uchun aynan shu OTM sizga kerakligini tushuntirib berishi shart.", time: "11:28" }
        ],
        "cr-javohir": [
          { sender: "Javohir Sindarov", isMe: false, text: "Salom! Men MIT talabasiman. Common App, SAT yoki to'liq grantlar bo'yicha qanday savolingiz bo'lsa bering, yordam berishdan xursandman!", time: "Kuni kecha" }
        ],
        "cr-madina": [
          { sender: "Madina Karimova", isMe: false, text: "Assalomu alaykum! Chevening stipendiyasi yoki Buyuk Britaniya magistraturasi bo'yicha qiziqqan savollaringizni yozing.", time: "Kuni kecha" }
        ],
        "cr-bekzod": [
          { sender: "Bekzod Rustamov", isMe: false, text: "Salom! Germaniyada nemis tilisiz, faqat ingliz tilida bepul o'qish va DAAD stipendiyasi bo'yicha maslahat bera olaman.", time: "Kuni kecha" }
        ],
        "cr-shahnoza": [
          { sender: "Shahnoza Alimova", isMe: false, text: "Annyonghaseyo! Janubiy Koreyaning GKS (KGSP) hukumati to'liq granti bo'yicha savollaringiz bormi?", time: "Kuni kecha" }
        ]
      };
    }

    function renderChatChannelsList() {
      const list = document.getElementById('chatChannelsList');
      if (!list) return;

      let html = '';
      CHAT_CHANNELS.forEach(ch => {
        const isActive = ch.id === activeChatChannel;
        html += `
          <div class="chat-channel-item ${isActive ? 'active' : ''}" onclick="selectChatChannel('${ch.id}')">
            <div class="ch-avatar" style="background:${ch.avatarBg};">
              ${ch.initials}
              ${ch.online ? '<span class="online-dot"></span>' : ''}
            </div>
            <div class="ch-meta">
              <div class="ch-name">
                <span>${ch.name}</span>
              </div>
              <div class="ch-sub">${ch.role}</div>
            </div>
          </div>
        `;
      });

      list.innerHTML = html;
    }

    function selectChatChannel(chId) {
      activeChatChannel = chId;
      renderChatChannelsList();
      renderChatMessages();
    }

    function renderChatMessages() {
      const wrap = document.getElementById('chatMessagesWrap');
      const header = document.getElementById('chatTargetHeader');
      if (!wrap || !header) return;

      const ch = CHAT_CHANNELS.find(c => c.id === activeChatChannel) || CHAT_CHANNELS[0];

      // Header yangilash
      header.innerHTML = `
        <div class="ch-avatar" style="background:${ch.avatarBg}; width:44px; height:44px;">
          ${ch.initials}
          <span class="online-dot"></span>
        </div>
        <div>
          <h4 style="font-size:0.95rem; font-weight:800; color:var(--text);">${ch.name}</h4>
          <span style="font-size:0.75rem; color:#10b981; font-weight:700;">🟢 Online • Javob qaytarishga tayyor</span>
        </div>
      `;

      // Xabarlar
      const msgs = chatHistories[activeChatChannel] || [];
      let html = '';
      msgs.forEach(m => {
        const isSent = m.isMe;
        html += `
          <div class="chat-msg ${isSent ? 'sent' : 'received'}">
            <div class="msg-sender-name">${m.sender}</div>
            <div>${m.text}</div>
            <div class="msg-time">${m.time}</div>
          </div>
        `;
      });

      wrap.innerHTML = html;
      scrollChatToBottom();
    }

    function scrollChatToBottom() {
      const wrap = document.getElementById('chatMessagesWrap');
      if (wrap) {
        wrap.scrollTop = wrap.scrollHeight;
      }
    }

    function handleSendChatMessage(e) {
      e.preventDefault();
      const input = document.getElementById('chatMsgInput');
      const text = input.value.trim();
      if (!text) return;

      const myName = currentUser ? currentUser.name : "Siz";
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      if (!chatHistories[activeChatChannel]) {
        chatHistories[activeChatChannel] = [];
      }

      // Xabarni qo'shish
      chatHistories[activeChatChannel].push({
        sender: myName,
        isMe: true,
        text: text,
        time: timeStr
      });

      input.value = '';
      renderChatMessages();
      saveChatHistory();

      // MENTORNING AVTOMATIK JAVOBI (SIMULYATSIYA)
      setTimeout(() => {
        simulateMentorReply(text);
      }, 1300);
    }

    function simulateMentorReply(userQuestion) {
      const ch = CHAT_CHANNELS.find(c => c.id === activeChatChannel) || CHAT_CHANNELS[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      let replyText = "";
      const q = userQuestion.toLowerCase();

      if (activeChatChannel === 'cr-javohir') {
        if (q.includes('ielts') || q.includes('sat')) {
          replyText = "Men SAT dan 1520 va IELTS dan 8.0 olganman. Asosiy siri — har kuni kamida 2 ta to'liq practice test yechish va faqat xatolar ustida chuqur ishlash. Savolingiz bo'yicha profilimdagi videoni ko'rishni maslahat beraman!";
        } else if (q.includes('insho') || q.includes('essay') || q.includes('sop')) {
          replyText = "MIT komissiyasi insholarda faqat a'lochi ekaningizni emas, dunyoni yaxshilashga qaratilgan amaliy loyihalaringizni ko'rishni xohlaydi. O'zingiz qiziqqan sohada biror foydali ish qilganmisiz?";
        } else {
          replyText = `Juda o'rinli savol! "${userQuestion}" bo'yicha o'z tajribamdan aytamanki, eng asosiysi deadline dan kamida 1 oy oldin barcha hujjatlarni topshirib qo'yish kerak. Savolingiz bo'lsa yana yozing!`;
        }
      } else if (activeChatChannel === 'cr-madina') {
        replyText = "Chevening stipendiyasida eng asosiy e'tibor 4 ta inshoga qaratiladi: Leadership, Networking, Study in the UK va Career Plan. O'zbekiston uchun kelajakda qanday foyda keltirishingizni aniq ko'rsatib berishingiz lozim.";
      } else if (activeChatChannel === 'cr-bekzod') {
        replyText = "Germaniyaning TUM universitetida Data Science bo'yicha o'qiyman. DAAD granti har oy 1,200 evro stipendiya beradi. Nemis tilisiz, faqat IELTS 6.5+ bilan ham qabul qilinish mutlaqo mumkin!";
      } else if (activeChatChannel === 'cr-shahnoza') {
        replyText = "Janubiy Koreyaning GKS granti parvoz, bepul yotoqxona va 1 yillik bepul koreys tili kursini to'liq qoplab beradi. Tavsiyanoma (Recommendation letter) juda kuchli bo'lishi kerak.";
      } else {
        // Global forum
        replyText = "Assalomu alaykum! Ushbu yo'nalish bo'yicha saytimizning 'Grantlar Katalogi' bo'limida 155 dan ortiq imkoniyatlar bor. 'Ariza Yo'riqnomasi' tugmasini bosib, bosqichma-bosqich qadamlarni ko'rib chiqing!";
      }

      chatHistories[activeChatChannel].push({
        sender: ch.name.split(' ')[0] + " (Mentor)",
        isMe: false,
        text: replyText,
        time: timeStr
      });

      renderChatMessages();
      saveChatHistory();
    }

    function saveChatHistory() {
      localStorage.setItem('gf_chat_histories', JSON.stringify(chatHistories));
    }

    function viewCurrentMentorProfile() {
      const ch = CHAT_CHANNELS.find(c => c.id === activeChatChannel);
      if (ch && ch.id !== 'global') {
        openCreatorProfile(ch.id);
      } else {
        showToast("Umumiy forumni barcha talabalar kuzatib boradi.", 'info');
      }
    }

    /* ========================================================
       6. GRANTLAR KATALOGI VA FILTRLAR (155 TA GRANT)
       ======================================================== */
    function setCategoryFilter(cat) {
      currentCategory = cat;
      document.querySelectorAll('#categoryPills .cat-pill-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
      });
      applyFilters();
    }

    function handleGrantSearch() {
      currentSearch = document.getElementById('grantSearch').value.trim().toLowerCase();
      applyFilters();
    }

    function applyFilters() {
      currentCountry = document.getElementById('filterCountry').value;
      currentDegree = document.getElementById('filterDegree').value;
      currentIelts = document.getElementById('filterIelts').value;

      filteredGrants = allGrants.filter(g => {
        // Kategoriya
        if (currentCategory !== 'all' && g.category !== currentCategory) return false;

        // Qidiruv
        if (currentSearch) {
          const matchTitle = (g.title || '').toLowerCase().includes(currentSearch);
          const matchUniv = (g.university || '').toLowerCase().includes(currentSearch);
          const matchCountry = (g.country || '').toLowerCase().includes(currentSearch);
          const matchField = (g.field || '').toLowerCase().includes(currentSearch);
          if (!matchTitle && !matchUniv && !matchCountry && !matchField) return false;
        }

        // Davlat
        if (currentCountry !== 'all' && g.country !== currentCountry) {
          if (currentCountry === 'Yevropa' && !['Germaniya','Fransiya','Italiya','Niderlandiya','Shvetsiya','Shveysariya','Polsha','Chexiya','Vengriya'].includes(g.country)) return false;
        }

        // Daraja
        if (currentDegree !== 'all' && g.degree !== currentDegree) return false;

        // IELTS
        if (currentIelts === 'required' && (!g.ielts || g.ielts.toLowerCase().includes("yo'q") || g.ielts.toLowerCase().includes('talab qilinmaydi'))) return false;
        if (currentIelts === 'none' && g.ielts && !g.ielts.toLowerCase().includes("yo'q") && !g.ielts.toLowerCase().includes('talab qilinmaydi') && !g.ielts.toLowerCase().includes('ixtiyoriy')) return false;

        // Faqat saqlanganlar
        if (showOnlySaved && !favorites.has(g.id)) return false;

        return true;
      });

      displayedCount = 12;
      renderGrants();
      updateFilterStats();
    }

    function resetFilters() {
      currentCategory = 'all';
      currentCountry = 'all';
      currentDegree = 'all';
      currentIelts = 'all';
      currentSearch = '';
      showOnlySaved = false;

      document.getElementById('grantSearch').value = '';
      document.getElementById('filterCountry').value = 'all';
      document.getElementById('filterDegree').value = 'all';
      document.getElementById('filterIelts').value = 'all';
      document.getElementById('btnOnlySaved').classList.remove('active');

      document.querySelectorAll('#categoryPills .cat-pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === 'all');
      });

      applyFilters();
    }

    function updateCategoryCounts() {
      const cAll = allGrants.length;
      const cUniv = allGrants.filter(g => g.category === 'Universitet Grantlari').length;
      const cConf = allGrants.filter(g => g.category === 'Xalqaro Konferensiyalar').length;
      const cExch = allGrants.filter(g => g.category === 'Almashinuv Dasturlari').length;
      const cShort = allGrants.filter(g => g.category === 'Qisqa Muddatli & Yozgi').length;

      if (document.getElementById('countAll')) document.getElementById('countAll').textContent = cAll;
      if (document.getElementById('countUniv')) document.getElementById('countUniv').textContent = cUniv;
      if (document.getElementById('countConf')) document.getElementById('countConf').textContent = cConf;
      if (document.getElementById('countExch')) document.getElementById('countExch').textContent = cExch;
      if (document.getElementById('countShort')) document.getElementById('countShort').textContent = cShort;
    }

    function updateFilterStats() {
      const stats = document.getElementById('filterStatsCount');
      if (stats) stats.textContent = `${filteredGrants.length} ta`;
      const favBadge = document.getElementById('savedCount');
      if (favBadge) favBadge.textContent = favorites.size;
      const profFavBadge = document.getElementById('profFavCount');
      if (profFavBadge) profFavBadge.textContent = favorites.size;
    }

    function renderGrants() {
      const container = document.getElementById('grantsContainer');
      const loadMoreBtn = document.getElementById('btnLoadMore');
      if (!container) return;

      const slice = filteredGrants.slice(0, displayedCount);

      if (slice.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:50px 20px; background:var(--surface); border-radius:26px; border:1.5px dashed var(--border);">
            <div style="font-size:3rem; margin-bottom:10px;">🔍</div>
            <h3 style="font-size:1.2rem; font-weight:800; margin-bottom:6px;">Bunday mezon bo'yicha grantlar topilmadi</h3>
            <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:16px;">Iltimos, filtrlarni o'zgartiring yoki qidiruv so'zini tozalang.</p>
            <button class="btn-secondary btn-oval" onclick="resetFilters()">🔄 Barcha 155 ta Grantni Ko'rish</button>
          </div>
        `;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
      }

      let html = '';
      slice.forEach(g => {
        const isFav = favorites.has(g.id);
        let badgeClass = 'gc-badge';
        if (g.category === 'Xalqaro Konferensiyalar') badgeClass += ' conf';
        if (g.category === 'Almashinuv Dasturlari') badgeClass += ' exchange';

        html += `
          <div class="grant-card">
            <div>
              <div class="gc-header">
                <span class="${badgeClass}">${g.category}</span>
                <button class="btn-fav ${isFav ? 'active' : ''}" onclick="toggleFavorite('${g.id}')" title="Saqlash">
                  ${isFav ? '❤️' : '🤍'}
                </button>
              </div>

              <h3 class="gc-title">${g.title}</h3>
              <div class="gc-univ">
                <span>${g.flag || '🏛️'}</span>
                <strong>${g.university || g.country}</strong> • ${g.country}
              </div>

              <div class="gc-meta-tags">
                <span class="gc-tag">🎓 ${g.degree || 'Barchasi'}</span>
                <span class="gc-tag">🌐 IELTS: ${g.ielts || "Talab etilmaydi"}</span>
                <span class="gc-tag">⏱️ ${g.duration || 'Belgilanmagan'}</span>
              </div>

              <div class="gc-coverage">
                💰 <strong>Qoplanishi:</strong> ${g.coverage || "To'liq grant"}
              </div>
            </div>

            <div class="gc-footer">
              <button class="btn-secondary btn-oval" onclick="openGrantDetail('${g.id}')" style="font-size:0.82rem; padding:8px 12px;">
                ℹ️ Batafsil
              </button>
              <button class="btn-primary btn-oval" onclick="openApplicationGuide('${g.id}')" style="font-size:0.82rem; padding:8px 14px;">
                📝 Ariza Yo'riqnomasi
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      if (loadMoreBtn) {
        loadMoreBtn.style.display = displayedCount >= filteredGrants.length ? 'none' : 'inline-flex';
      }
    }

    function loadMoreGrants() {
      displayedCount += 12;
      renderGrants();
    }

    function toggleFavorite(id) {
      if (favorites.has(id)) {
        favorites.delete(id);
        showToast("Grant saqlanganlardan olib tashlandi.", 'info');
      } else {
        favorites.add(id);
        showToast("Grant saqlanganlarga qo'shildi! ❤️", 'success');
      }
      localStorage.setItem('gf_favs', JSON.stringify(Array.from(favorites)));
      renderGrants();
      updateFilterStats();
      renderProfileFavorites();
    }

    function toggleOnlySaved() {
      showOnlySaved = !showOnlySaved;
      document.getElementById('btnOnlySaved').classList.toggle('active', showOnlySaved);
      applyFilters();
    }

    function renderProfileFavorites() {
      const container = document.getElementById('profFavContainer');
      if (!container) return;

      const favGrants = allGrants.filter(g => favorites.has(g.id));
      if (favGrants.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding:30px; color:var(--text-muted); font-size:0.9rem;">
            Hozircha saqlangan grantlar yo'q. Katalogdan yoqqan grantlarga ❤️ bosib saqlab qo'yishingiz mumkin.
          </div>
        `;
        return;
      }

      let html = '';
      favGrants.slice(0, 6).forEach(g => {
        html += `
          <div class="grant-card" style="padding:18px;">
            <div class="gc-title" style="font-size:1.05rem;">${g.title}</div>
            <div class="gc-univ">${g.flag || '🏛️'} ${g.university} • ${g.country}</div>
            <div style="display:flex; gap:8px; margin-top:12px;">
              <button class="btn-secondary btn-oval" onclick="openGrantDetail('${g.id}')" style="flex:1; font-size:0.8rem; padding:6px 10px;">Batafsil</button>
              <button class="btn-primary btn-oval" onclick="openApplicationGuide('${g.id}')" style="flex:1; font-size:0.8rem; padding:6px 10px;">Yo'riqnoma</button>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    /* ========================================================
       7. GRANT DETAIL VA ARIZA YO'RIQNOMASI MODALLARI
       ======================================================== */
    function openGrantDetail(id) {
      const g = allGrants.find(x => x.id === id);
      if (!g) return;

      const content = document.getElementById('detailContent');
      content.innerHTML = `
        <div style="margin-bottom:16px;">
          <span class="gc-badge">${g.category}</span>
          <h2 style="font-family:var(--font-heading); font-size:1.5rem; font-weight:800; margin:8px 0;">${g.title}</h2>
          <div style="font-size:0.95rem; color:var(--text-muted);">
            ${g.flag || '🏛️'} <strong>${g.university}</strong> • ${g.country}
          </div>
        </div>

        <div style="background:var(--surface-subtle); border-radius:20px; padding:18px; margin-bottom:18px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:0.88rem;">
            <div><strong>Ta'lim darajasi:</strong><br>${g.degree || 'Barcha bosqichlar'}</div>
            <div><strong>IELTS talabi:</strong><br>${g.ielts || "Talab etilmaydi"}</div>
            <div><strong>Muddati (Deadline):</strong><br>${g.deadline || 'Har yili'}</div>
            <div><strong>Davomiyligi:</strong><br>${g.duration || "To'liq dastur"}</div>
          </div>
        </div>

        <div style="margin-bottom:18px; font-size:0.92rem; line-height:1.6;">
          <h4 style="font-size:0.98rem; font-weight:800; margin-bottom:6px;">💰 Moliyaviy Qamrovi:</h4>
          <p>${g.coverage || "To'liq o'qish xarajatlari va oylik stipendiya qoplanadi."}</p>
        </div>

        <div style="margin-bottom:24px; font-size:0.92rem; line-height:1.6;">
          <h4 style="font-size:0.98rem; font-weight:800; margin-bottom:6px;">📋 Asosiy Talablar:</h4>
          <p>${g.requirements || "Akademik ko'rsatkichlar (GPA), tavsiyanomalar va motivatsiya xati."}</p>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn-primary btn-oval" onclick="closeDetailModal(); openApplicationGuide('${g.id}')" style="flex:1; justify-content:center; padding:12px;">
            📝 Qadamma-qadam Ariza Yo'riqnomasi
          </button>
          <a href="${g.link || '#'}" target="_blank" class="btn-secondary btn-oval" style="flex:1; justify-content:center; padding:12px;">
            🌐 Rasmiy Portalga O'tish
          </a>
        </div>
      `;

      document.getElementById('detailModal').classList.add('active');
    }

    function closeDetailModal() {
      document.getElementById('detailModal').classList.remove('active');
    }

    function openApplicationGuide(id) {
      const g = allGrants.find(x => x.id === id);
      if (!g) return;

      const content = document.getElementById('guideContent');
      content.innerHTML = `
        <div style="margin-bottom:18px;">
          <span class="gc-badge" style="background:#e0e7ff; color:#4338ca;">Bosqichma-bosqich Ariza Yo'riqnomasi</span>
          <h3 style="font-family:var(--font-heading); font-size:1.35rem; font-weight:800; margin:6px 0;">
            ${g.title} uchun mukammal ariza tayyorlash
          </h3>
          <p style="font-size:0.86rem; color:var(--text-muted);">${g.university} • ${g.country}</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:22px;">
          <div style="background:var(--surface-subtle); border-radius:18px; padding:14px; border-left:4px solid #4f46e5;">
            <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">1-bosqich: Hujjatlarni Tayyorlash va Rasmiylashtirish</strong>
            <p style="font-size:0.84rem; color:var(--text-muted);">Diplom/Attestat ilovasi (GPA 4.5+), IELTS/TOEFL sertifikati, ATS-formatidagi professional Rezyume (CV).</p>
          </div>

          <div style="background:var(--surface-subtle); border-radius:18px; padding:14px; border-left:4px solid #10b981;">
            <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">2-bosqich: Motivatsiya Xati (SOP / Essay)</strong>
            <p style="font-size:0.84rem; color:var(--text-muted);">Nima uchun aynan shu dastur, O'zbekistonga qaytgach qanday loyihalar qilishingiz haqida aniq reja yozing. Matningizni bizning <strong>AI Mentor</strong> bo'limida tahlil qiling.</p>
          </div>

          <div style="background:var(--surface-subtle); border-radius:18px; padding:14px; border-left:4px solid #f59e0b;">
            <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">3-bosqich: Professorlardan Kuchli Tavsiyanomalar (2-3 ta)</strong>
            <p style="font-size:0.84rem; color:var(--text-muted);">Sizni yaxshi biladigan ilmiy rahbar yoki ish beruvchingizdan rasmiy xat oling.</p>
          </div>

          <div style="background:var(--surface-subtle); border-radius:18px; padding:14px; border-left:4px solid #8b5cf6;">
            <strong style="display:block; font-size:0.9rem; margin-bottom:4px;">4-bosqich: Suhbatga (Interview) Tayyorgarlik</strong>
            <p style="font-size:0.84rem; color:var(--text-muted);">Universitet qabul komissiyasi bilan online suhbatda STAR metodikasidan foydalanib o'z tajribangizni yetkazib bering.</p>
          </div>
        </div>

        <div style="display:flex; gap:12px;">
          <button class="btn-primary btn-oval" onclick="closeGuideModal(); switchView('ai');" style="flex:1; justify-content:center; padding:12px;">
            🤖 Motivatsiya Xatini AI Bilan Tahlil Qilish
          </button>
          <button class="btn-secondary btn-oval" onclick="closeGuideModal(); switchView('chat');" style="flex:1; justify-content:center; padding:12px;">
            💬 Talabalardan Maslahat Olish
          </button>
        </div>
      `;

      document.getElementById('guideModal').classList.add('active');
    }

    function closeGuideModal() {
      document.getElementById('guideModal').classList.remove('active');
    }

    /* ========================================================
       8. VATANDOSHLAR TAJRIBASI (REELS SOCIAL FEED)
       ======================================================== */
    let SCHOLAR_STORIES = [
      {
        id: "story-1",
        creatorId: "cr-javohir",
        creator: {
          id: "cr-javohir",
          name: "Javohir Sindarov",
          initials: "JS",
          avatarBg: "linear-gradient(135deg, #10b981, #06b6d4)",
          university: "Massachusetts Institute of Technology (MIT)",
          country: "AQSH",
          flag: "🇺🇸",
          grant: "100% Need-Blind ($85k/yil)"
        },
        title: "SAT 1520 va IELTS 8.0 bilan MIT ga to'liq grant yutish sirlari",
        videoLength: "18:45",
        views: "28.4k",
        likes: 2430,
        isLiked: false,
        region: "usa",
        desc: "Maktabdan dunyoning eng nufuzli texnika universiteti MIT gacha bo'lgan yo'lim. Common App insholari va interview bosqichlari.",
        comments: [
          { user: "Umidjon", text: "Javohir aka, insho mavzusini qanday tanlagansiz? Katta rahmat maslahatlar uchun!" },
          { user: "Dildora", text: "Maktab baholari (GPA) 4.8 bo'lsa ham topshirsa bo'ladimi?" }
        ]
      },
      {
        id: "story-2",
        creatorId: "cr-madina",
        creator: {
          id: "cr-madina",
          name: "Madina Karimova",
          initials: "MK",
          avatarBg: "linear-gradient(135deg, #8b5cf6, #ec4899)",
          university: "University of Oxford",
          country: "Buyuk Britaniya",
          flag: "🇬🇧",
          grant: "Chevening UK Scholarship"
        },
        title: "Chevening granti va Oxford suhbati: 4 ta inshoni yozish qoidalari",
        videoLength: "22:15",
        views: "19.1k",
        likes: 1890,
        isLiked: false,
        region: "uk",
        desc: "Chevening arizasidagi 4 ta asosiy insho: Leadership, Networking, Study in the UK va Career Plan sirlari.",
        comments: [
          { user: "Gulnoza", text: "Madina opa, ish tajribasi kamida 2 yil bo'lishi shartmi?" }
        ]
      },
      {
        id: "story-3",
        creatorId: "cr-bekzod",
        creator: {
          id: "cr-bekzod",
          name: "Bekzod Rustamov",
          initials: "BR",
          avatarBg: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
          university: "Technical University of Munich (TUM)",
          country: "Germaniya",
          flag: "🇩🇪",
          grant: "DAAD Study Scholarship (1,200€/oy)"
        },
        title: "Germaniyada bepul magistratura va DAAD 1,200€ stipendiyasi",
        videoLength: "16:30",
        views: "16.5k",
        likes: 1420,
        isLiked: false,
        region: "europe",
        desc: "Nemis tilisiz, faqat IELTS 6.5+ bilan Germaniyaning eng nufuzli texnika OTMlariga bepul kirish.",
        comments: [
          { user: "Farrux", text: "Uni-Assist orqali topshirish qancha vaqt oladi?" }
        ]
      },
      {
        id: "story-4",
        creatorId: "cr-shahnoza",
        creator: {
          id: "cr-shahnoza",
          name: "Shahnoza Alimova",
          initials: "SA",
          avatarBg: "linear-gradient(135deg, #f59e0b, #ef4444)",
          university: "Seoul National University (SNU)",
          country: "Janubiy Koreya",
          flag: "🇰🇷",
          grant: "Global Korea Scholarship (GKS)"
        },
        title: "Koreya davlatining GKS 100% to'liq grantini yutish strategiyasi",
        videoLength: "19:10",
        views: "21.3k",
        likes: 1980,
        isLiked: false,
        region: "asia",
        desc: "Elchixona orqali topshirish, bepul koreys tili kurslari va Seulda talabalik hayoti.",
        comments: [
          { user: "Zarina", text: "TOPIK sertifikati bo'lishi majburiymi?" }
        ]
      }
    ];

    let currentStoryRegion = 'all';

    function filterStoriesRegion(reg) {
      currentStoryRegion = reg;
      document.querySelectorAll('[data-sregion]').forEach(b => {
        b.classList.toggle('active', b.dataset.sregion === reg);
      });
      renderStories();
    }

    function renderStories() {
      const container = document.getElementById('storiesContainer');
      if (!container) return;

      const filtered = SCHOLAR_STORIES.filter(s => currentStoryRegion === 'all' || s.region === currentStoryRegion);

      let html = '';
      filtered.forEach(s => {
        const isSub = userSubscriptions.has(s.creatorId);
        html += `
          <div class="story-card">
            <div class="story-thumbnail" onclick="openVideoPlayer('${s.id}')">
              <div class="play-btn-circle">▶</div>
              <span class="story-country-badge">${s.creator.flag} ${s.creator.country}</span>
              <span class="story-length-badge">⏱️ ${s.videoLength}</span>
            </div>

            <div class="story-body">
              <div class="story-creator-row">
                <div class="creator-left" onclick="openCreatorProfile('${s.creatorId}')">
                  <div class="creator-avatar" style="background:${s.creator.avatarBg};">
                    ${s.creator.initials}
                  </div>
                  <div class="creator-text">
                    <h4>${s.creator.name}</h4>
                    <p>${s.creator.university.split('(')[0]}</p>
                  </div>
                </div>

                <button class="btn-sub-toggle ${isSub ? 'subscribed' : ''}" onclick="toggleStorySubscribe('${s.creatorId}')">
                  ${isSub ? '✓ Obunadasiz' : '🔔 Obuna'}
                </button>
              </div>

              <div class="story-title" onclick="openVideoPlayer('${s.id}')">${s.title}</div>
              <div class="story-desc">${s.desc}</div>

              <div class="story-social-bar">
                <div class="social-actions-left">
                  <button class="social-btn ${s.isLiked ? 'liked' : ''}" onclick="toggleStoryLike('${s.id}')">
                    ${s.isLiked ? '❤️' : '🤍'} <span>${s.likes}</span>
                  </button>
                  <button class="social-btn" onclick="openVideoPlayer('${s.id}')">
                    💬 <span>${s.comments.length}</span>
                  </button>
                </div>
                <div>👁️ ${s.views}</div>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    function toggleStoryLike(id) {
      const s = SCHOLAR_STORIES.find(x => x.id === id);
      if (!s) return;
      s.isLiked = !s.isLiked;
      s.likes += s.isLiked ? 1 : -1;
      renderStories();
    }

    function openVideoPlayer(id) {
      const s = SCHOLAR_STORIES.find(x => x.id === id);
      if (!s) return;

      const isSub = userSubscriptions.has(s.creatorId);
      const content = document.getElementById('videoPlayerContent');
      content.innerHTML = `
        <div style="background:#0f172a; border-radius:24px; padding:30px 20px; color:#fff; text-align:center; margin-bottom:18px;">
          <div style="width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin:0 auto 12px auto; cursor:pointer;">
            ▶
          </div>
          <h3 style="font-size:1.25rem; font-weight:800; margin-bottom:6px;">${s.title}</h3>
          <p style="font-size:0.85rem; opacity:0.8;">${s.creator.flag} ${s.creator.university} • ${s.creator.grant}</p>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="creator-avatar" style="background:${s.creator.avatarBg}; width:46px; height:46px;">
              ${s.creator.initials}
            </div>
            <div>
              <strong style="display:block; font-size:0.95rem;">${s.creator.name}</strong>
              <span style="font-size:0.78rem; color:var(--text-muted);">${s.creator.university}</span>
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button class="btn-sub-toggle ${isSub ? 'subscribed' : ''}" onclick="toggleStorySubscribe('${s.creatorId}'); closeVideoPlayerModal();">
              ${isSub ? '✓ Obunadasiz' : "🔔 Obuna Bo'lish"}
            </button>
            <button class="btn-primary btn-oval" onclick="closeVideoPlayerModal(); openChatWithMentor('${s.creatorId}');" style="padding:6px 14px; font-size:0.8rem;">
              💬 Chat
            </button>
          </div>
        </div>

        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.6; margin-bottom:18px;">
          ${s.desc}
        </p>

        <!-- IZOHLAR -->
        <div style="border-top:1px solid var(--border); padding-top:14px;">
          <h4 style="font-size:0.9rem; font-weight:800; margin-bottom:10px;">💬 Foydalanuvchilar Izohlari (${s.comments.length}):</h4>
          <div style="max-height:140px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; margin-bottom:14px;" id="playerCommentsList">
            ${s.comments.map(c => '<div style="background:var(--surface-subtle); padding:8px 14px; border-radius:14px; font-size:0.84rem;"><strong>' + c.user + ':</strong> ' + c.text + '</div>').join('')}
          </div>

          <form onsubmit="handleSendComment(event, '${s.id}')" style="display:flex; gap:8px;">
            <input type="text" id="commInput" class="input-oval" placeholder="O'z savolingiz yoki fikringizni yozing..." required />
            <button type="submit" class="btn-primary btn-oval" style="padding:10px 18px; flex-shrink:0;">Yuborish</button>
          </form>
        </div>
      `;

      document.getElementById('videoPlayerModal').classList.add('active');
    }

    function closeVideoPlayerModal() {
      document.getElementById('videoPlayerModal').classList.remove('active');
    }

    function handleSendComment(e, storyId) {
      e.preventDefault();
      const input = document.getElementById('commInput');
      const text = input.value.trim();
      if (!text) return;

      const s = SCHOLAR_STORIES.find(x => x.id === storyId);
      if (s) {
        const myName = currentUser ? currentUser.name : "Foydalanuvchi";
        s.comments.push({ user: myName, text: text });
        openVideoPlayer(storyId);
        showToast("Izohingiz qo'shildi! 💬", 'success');
      }
    }

    function openCreatorProfile(cid) {
      const creator = getCreatorData(cid);
      if (!creator) return;

      const isSub = userSubscriptions.has(cid);
      const creatorStories = SCHOLAR_STORIES.filter(s => s.creatorId === cid);

      const content = document.getElementById('creatorProfileContent');
      content.innerHTML = `
        <div style="text-align:center; margin-bottom:20px;">
          <div class="creator-avatar" style="background:${creator.avatarBg}; width:72px; height:72px; font-size:1.6rem; margin:0 auto 10px auto;">
            ${creator.initials}
          </div>
          <h3 style="font-size:1.35rem; font-weight:800;">${creator.name} ${creator.flag}</h3>
          <p style="color:var(--primary); font-weight:700; font-size:0.9rem;">${creator.university}</p>
          <p style="color:var(--text-muted); font-size:0.82rem; margin-top:2px;">🏆 ${creator.grant}</p>

          <div style="display:flex; justify-content:center; gap:10px; margin-top:14px;">
            <button class="btn-sub-toggle ${isSub ? 'subscribed' : ''}" onclick="toggleStorySubscribe('${creator.id}'); closeCreatorProfileModal();">
              ${isSub ? '✓ Obunadasiz' : "🔔 Obuna Bo'lish"}
            </button>
            <button class="btn-primary btn-oval" onclick="closeCreatorProfileModal(); openChatWithMentor('${creator.id}');" style="padding:8px 18px; font-size:0.84rem;">
              💬 To'g'ridan-to'g'ri Chat
            </button>
          </div>
        </div>

        <h4 style="font-size:0.95rem; font-weight:800; margin-bottom:12px;">🎬 Muallifning Barcha Videolari (${creatorStories.length}):</h4>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${creatorStories.map(st => '<div style="background:var(--surface-subtle); padding:12px 16px; border-radius:16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="closeCreatorProfileModal(); openVideoPlayer(\'' + st.id + '\');"><div><strong style="font-size:0.88rem; display:block;">' + st.title + '</strong><span style="font-size:0.76rem; color:var(--text-muted);">⏱️ ' + st.videoLength + ' • 👁️ ' + st.views + '</span></div><span style="font-size:1.2rem;">▶</span></div>').join('')}
        </div>
      `;

      document.getElementById('creatorProfileModal').classList.add('active');
    }

    function closeCreatorProfileModal() {
      document.getElementById('creatorProfileModal').classList.remove('active');
    }

    /* ========================================================
       9. VIDEO / MASLAHAT YUKLASH (CHET ELDAGI TALABA & ADMIN)
       ======================================================== */
    function openUploadStoryModal() {
      if (currentUser && currentUser.role === 'applicant') {
        showToast("Kechirasiz, video darslik yuklash faqat chet eldagi talabalar uchun ochiq.", 'info');
        return;
      }
      document.getElementById('uploadStoryModal').classList.add('active');
    }

    function closeUploadStoryModal() {
      document.getElementById('uploadStoryModal').classList.remove('active');
    }

    function handleUploadStorySubmit(e) {
      e.preventDefault();
      const title = document.getElementById('upTitle').value.trim();
      const reg = document.getElementById('upRegion').value;
      const desc = document.getElementById('upDesc').value.trim();

      const newStory = {
        id: "story-" + Date.now(),
        creatorId: "cr-user-" + Date.now(),
        creator: {
          id: "cr-user-" + Date.now(),
          name: currentUser ? currentUser.name : "Vatandosh Talaba",
          initials: (currentUser ? currentUser.name : "VT").slice(0,2).toUpperCase(),
          avatarBg: "linear-gradient(135deg, #4f46e5, #06b6d4)",
          university: currentUser && currentUser.univ ? currentUser.univ : "Xalqaro Universitet",
          country: reg === 'usa' ? 'AQSH' : reg === 'uk' ? 'Buyuk Britaniya' : reg === 'europe' ? 'Yevropa' : 'Osiyo',
          flag: reg === 'usa' ? '🇺🇸' : reg === 'uk' ? '🇬🇧' : reg === 'europe' ? '🇪🇺' : '🌏',
          grant: currentUser && currentUser.grantName ? currentUser.grantName : "Xalqaro Grant"
        },
        title: title,
        videoLength: "12:40",
        views: "1",
        likes: 1,
        isLiked: true,
        region: reg,
        desc: desc,
        comments: [
          { user: "Moderator", text: "Videongiz tarmoqqa muvaffaqiyatli joylashtirildi!" }
        ]
      };

      SCHOLAR_STORIES.unshift(newStory);
      closeUploadStoryModal();
      renderStories();
      showToast("Yangi video maslahat tarmoqqa muvaffaqiyatli qo'shildi! 🎉", 'success');
    }

    /* ========================================================
       10. AI MENTOR (SOP, CV, ESSAY TAHLILI)
       ======================================================== */
    let currentAiTab = 'sop';

    const SAMPLE_TEXTS = {
      sop: "My goal is to pursue a Master of Science in Computer Science at MIT. During my undergraduate studies, I led a machine learning research team developing an automated diagnostic system for rural clinics. This project ignited my passion for applying artificial intelligence to real-world healthcare challenges. I chose MIT because of Professor John Doe's groundbreaking work in neural networks, which directly aligns with my aspirations to return to Uzbekistan and modernize our national healthcare infrastructure.",
      cv: "EDUCATION:\nBachelor of Science in Software Engineering, GPA: 4.8/5.0 (Top 2%)\n\nTECHNICAL SKILLS:\nPython, PyTorch, React, Node.js, SQL, Docker, AWS\n\nPROJECTS:\n- AI Medical Assistant: Developed NLP pipeline processing 10,000+ patient records with 94% accuracy.\n- Open-Source Contributor: Contributed 12 PRs to international robotics repositories.\n\nLEADERSHIP & AWARDS:\n- 1st Place at National Hackathon 2025\n- Team Captain of University Competitive Programming Club",
      essay: "Growing up in a small town in Samarkand, access to advanced STEM education was limited. However, this challenge fueled my curiosity rather than hindering it. I transformed our school's dusty library into a weekly coding club for 25 high school students. This taught me that leadership is not about personal accolades, but about elevating those around you. Through the Fulbright Scholarship, I intend to acquire the institutional expertise necessary to scale STEM opportunities across Central Asia."
    };

    function switchAiTab(tab) {
      currentAiTab = tab;
      document.getElementById('aiTabSop').classList.toggle('active', tab === 'sop');
      document.getElementById('aiTabCv').classList.toggle('active', tab === 'cv');
      document.getElementById('aiTabEssay').classList.toggle('active', tab === 'essay');

      const label = document.getElementById('aiInputLabel');
      if (tab === 'sop') label.textContent = "Motivatsiya xati (Statement of Purpose) matnini kiriting:";
      if (tab === 'cv') label.textContent = "Akademik Rezyume (CV) matnini kiriting:";
      if (tab === 'essay') label.textContent = "Grant inshosi (Leadership / Personal Essay) matnini kiriting:";

      document.getElementById('aiResultsBlock').style.display = 'none';
    }

    function loadSampleText() {
      document.getElementById('aiTextInput').value = SAMPLE_TEXTS[currentAiTab] || '';
      showToast("Namuna matn maydonga joylandi. Endi 'Tahlil Qilish'ni bosing.", 'info');
    }

    function runAiAnalysis() {
      const text = document.getElementById('aiTextInput').value.trim();
      if (!text || text.length < 30) {
        showToast("Iltimos, tahlil qilish uchun kamida 30 ta so'zdan iborat matn kiriting.", 'info');
        return;
      }

      showToast("AI neyrotarmoq matnni chuqur tahlil qilmoqda... ⏳", 'info');

      setTimeout(() => {
        const results = document.getElementById('aiResultsBlock');
        results.style.display = 'block';

        const scoreNum = document.getElementById('aiScoreNumber');
        const scoreBadge = document.getElementById('aiScoreBadge');
        const docLabel = document.getElementById('aiDocTypeLabel');

        let score = 88;
        if (text.length > 500) score = 94;
        else if (text.length < 150) score = 76;

        scoreNum.textContent = score + " / 100";
        docLabel.textContent = "Hujjat turi: " + (currentAiTab === 'sop' ? 'Motivatsiya Xati (SOP)' : currentAiTab === 'cv' ? 'Rezyume (CV)' : 'Grant Inshosi');

        if (score >= 90) {
          scoreBadge.textContent = "🌟 Ekspert Darajasi (90%+)";
          scoreBadge.style.background = "#dcfce7";
          scoreBadge.style.color = "#15803d";
        } else if (score >= 80) {
          scoreBadge.textContent = "✅ Yuqori Imkoniyat (80-89%)";
          scoreBadge.style.background = "#e0e7ff";
          scoreBadge.style.color = "#4338ca";
        } else {
          scoreBadge.textContent = "⚠️ Qayta ishlash tavsiya etiladi";
          scoreBadge.style.background = "#fef3c7";
          scoreBadge.style.color = "#b45309";
        }

        results.scrollIntoView({ behavior: 'smooth' });
        showToast("Tahlil tayyor! Xulosa va tavsiyalar bilan tanishing. ✨", 'success');
      }, 900);
    }

    /* ========================================================
       11. PWA O'RNATISH (YUKLAB OLISH) TIZIMI
       Android, iPhone, PC uchun to'liq yo'riqnoma va so'rov
       ======================================================== */
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.style.display = 'inline-flex';
    });

    function triggerPwaInstall() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showToast("Ilova qurilmangizga o'rnatilmoqda... 🎉", 'success');
          }
          deferredPrompt = null;
        });
      } else {
        openInstallAppModal();
      }
    }

    function triggerNativeInstallPrompt() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showToast("Ilova muvaffaqiyatli o'rnatildi! 🎉", 'success');
            closeInstallAppModal();
          }
          deferredPrompt = null;
        });
      } else {
        showToast("Brauzerning avtomatik o'rnatish dialogi ochilmagan bo'lsa, yuqoridagi 3 qadamli yo'riqnomadan foydalaning.", 'info');
      }
    }

    function openInstallAppModal() {
      const m = document.getElementById('installAppModal');
      if (m) m.classList.add('active');

      const ua = navigator.userAgent || navigator.vendor || window.opera || '';
      if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
        switchInstallGuide('ios');
      } else if (/android/i.test(ua)) {
        switchInstallGuide('android');
      } else {
        switchInstallGuide('pc');
      }
    }

    function closeInstallAppModal() {
      const m = document.getElementById('installAppModal');
      if (m) m.classList.remove('active');
    }

    function switchInstallGuide(platform) {
      document.getElementById('guideAndroid').style.display = platform === 'android' ? 'block' : 'none';
      document.getElementById('guideIos').style.display = platform === 'ios' ? 'block' : 'none';
      document.getElementById('guidePc').style.display = platform === 'pc' ? 'block' : 'none';

      document.getElementById('instTabAndroid').classList.toggle('active', platform === 'android');
      document.getElementById('instTabIos').classList.toggle('active', platform === 'ios');
      document.getElementById('instTabPc').classList.toggle('active', platform === 'pc');
    }

    window.addEventListener('appinstalled', () => {
      showToast("Grant Finder ilovasi muvaffaqiyatli o'rnatildi! 🎉", 'success');
    });

    // Service Worker registratsiyasi
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('Grant Finder 2.0 SW faol! Scope:', reg.scope))
          .catch((err) => console.log('SW registratsiyasi (HTTPS yoki localhost kerak):', err));
      });
    }

    /* ========================================================
       12. UMUMIY YORDAMCHI FUNKSIYALAR
       ======================================================== */
    function toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
    }

    function showToast(msg, type = 'info') {
      const tray = document.getElementById('toastTray');
      if (!tray) return;

      const item = document.createElement('div');
      item.className = 'toast-item';
      if (type === 'success') {
        item.style.borderLeft = '4px solid #10b981';
      } else if (type === 'danger') {
        item.style.borderLeft = '4px solid #ef4444';
      } else {
        item.style.borderLeft = '4px solid #4f46e5';
      }
      item.textContent = msg;

      tray.appendChild(item);
      setTimeout(() => {
        item.style.opacity = '0';
        item.style.transition = 'opacity 0.3s ease';
        setTimeout(() => item.remove(), 300);
      }, 3400);
    }
