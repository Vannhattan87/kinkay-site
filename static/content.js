// KINKAY — content song ngữ. Sửa text ở đây, không cần đụng index.html.
window.CONTENT = {
  meta: {
    title: { vi: "KINKAY — Makeup Cô Dâu & Trang Điểm Dự Tiệc TP.HCM", en: "KINKAY — Bridal & Event Makeup, Hair Styling | HCMC" }
  },
  nav: {
    approach: { vi: "Phương pháp", en: "Approach" },
    portfolio: { vi: "Portfolio", en: "Portfolio" },
    tryon: { vi: "Thử look", en: "Try a look" },
    testi: { vi: "Cảm nhận", en: "Reviews" },
    masterclass: { vi: "Học 1:1", en: "Class" },
    services: { vi: "Dịch vụ", en: "Services" },
    about: { vi: "Về Kay", en: "About Kay" },
    blog: { vi: "Blog", en: "Blog" },
    book: { vi: "Đặt lịch", en: "Book Now" },
    brides: { vi: "Cho cô dâu", en: "For brides" }
  },

  /* ======================================================================
     01/09/2026 — BO SUNG BAN TIENG ANH
     Bat nut EN tren trang chu truoc day van con 42 cho tieng Viet: nut so cap
     cua nav, toan bo dropdown, nhan + placeholder + option cua form dat lich,
     ca ba cot footer, ghi chu Before/After, uu dai ngay thuong, va ngay thang
     bai blog. Ly do: nhung cho do khong he co thuoc tinh data-t nen bo dich
     khong voi toi. Khach nuoc ngoai bam EN ma nua trang van tieng Viet thi
     moi thu con lai cua chien luoc tieng Anh deu vo nghia.

     `pages` va `hint` co y dat rieng va DUNG CHUNG cho ca nav lan footer —
     mot ten trang chi khai mot lan, khong the co chuyen nav dich mot kieu
     footer dich mot kieu.
     ====================================================================== */
  pages: {
    bridal:      { vi: "Makeup cô dâu",             en: "Bridal makeup" },
    party:       { vi: "Trang điểm dự tiệc",        en: "Event makeup" },
    hair:        { vi: "Hair styling",              en: "Hair styling" },
    shoot:       { vi: "Photoshoot & editorial",    en: "Photoshoot & editorial" },
    profile:     { vi: "Ảnh profile công ty",       en: "Business profile photos" },
    gift:        { vi: "Quà tặng & voucher",        en: "Gift vouchers" },
    guide:       { vi: "Cẩm nang 12 tuần",          en: "12-week bridal guide" },
    countdown:   { vi: "Lịch đếm ngược ngày cưới",  en: "Wedding countdown" },
    beforeAfter: { vi: "Before & After",            en: "Before & After" },
    vendors:     { vi: "Ekip cưới tin dùng",        en: "Wedding vendors" },
    faq:         { vi: "Câu hỏi thường gặp",        en: "FAQ" },
    faqMore:     { vi: "Câu hỏi thường gặp →",      en: "FAQ →" },
    about:       { vi: "Về Kay",                    en: "About Kay" },
    masterclass: { vi: "Masterclass 1:1",           en: "1:1 Masterclass" },
    blog:        { vi: "Blog",                      en: "Blog" },
    review:      { vi: "Đánh giá trên Google",      en: "Review on Google" },
    english:     { vi: "English",                   en: "English" },
    englishMore: { vi: "English →",                 en: "English →" }
  },
  hint: {
    bridalPrice: { vi: "3 – 5 triệu",   en: "3 – 5M VND" },
    from18:      { vi: "Từ 1.8 triệu",  en: "From 1.8M" },
    from15:      { vi: "Từ 1.5 triệu",  en: "From 1.5M" },
    inCombo:     { vi: "Trong combo",   en: "In every package" },
    from500k:    { vi: "Từ 500k",       en: "From 500k" },
    free:        { vi: "Miễn phí",      en: "Free" },
    tool:        { vi: "Công cụ",       en: "Tool" },
    realClients: { vi: "Khách thật",    en: "Real clients" },
    story:       { vi: "Câu chuyện",    en: "Her story" },
    enrolling:   { vi: "Đang nhận",     en: "Enrolling" }
  },
  ba: {
    eyebrow: { vi: "Khách thật của Kay", en: "Kay's real clients" },
    note: {
      vi: "Kéo thanh giữa ảnh để so sánh. Ảnh khách thật, đăng với sự đồng ý của khách — không filter, không chỉnh da.",
      en: "Drag the handle to compare. Real clients, posted with their consent — no filters, no skin retouching."
    }
  },
  offpeak: {
    label: { vi: "Ưu đãi ngày thường", en: "Weekday rate" }
  },
  form: {
    name:        { vi: "Tên của bạn",        en: "Your name" },
    namePh:      { vi: "Ví dụ: Ngọc Anh",    en: "e.g. Sarah" },
    occasion:    { vi: "Dịp",                en: "Occasion" },
    occasionOpts: {
      vi: ["— Chọn dịp —", "Cưới — ngày cưới", "Cưới — chụp ảnh cưới / pre-wedding", "Cưới — trial thử look",
           "Tiệc / sự kiện", "Chụp hình cá nhân / photoshoot", "Ăn hỏi / đám hỏi", "Mẹ cô dâu / người nhà", "Khác"],
      en: ["— Select —", "Wedding — the day itself", "Wedding — pre-wedding shoot", "Wedding — bridal trial",
           "Party / event", "Headshot / personal shoot", "Engagement ceremony", "Mother of the bride / family", "Other"]
    },
    date:        { vi: "Ngày cần makeup",    en: "Date you need makeup" },
    place:       { vi: "Địa điểm",           en: "Location" },
    placePh:     { vi: "Ví dụ: Quận 7, hoặc tên khách sạn", en: "e.g. District 7, or a hotel name" },
    budget:      { vi: "Ngân sách dự kiến",  en: "Budget range" },
    budgetOpts: {
      vi: ["— Chưa rõ, nhờ Kay tư vấn —", "Dưới 1.5 triệu", "1.5 – 3 triệu", "3 – 5 triệu", "Trên 5 triệu"],
      en: ["— Not sure, please advise —", "Under 1.5M VND", "1.5 – 3M VND", "3 – 5M VND", "Over 5M VND"]
    },
    note:        { vi: "Bạn muốn Kay biết thêm điều gì?", en: "Anything Kay should know?" },
    notePh:      { vi: "Số người cần makeup, giờ phải xong, kiểu look bạn thích...",
                   en: "How many people, what time you need to be ready, the look you have in mind..." },
    submit:      { vi: "Kiểm tra ngày trống", en: "Check my date" },
    after:       { vi: "Bấm xong Kay sẽ mở sẵn Zalo và điền giúp bạn tin nhắn — bạn chỉ cần dán và gửi.",
                   en: "Submitting opens Zalo with your message already written — you just paste and send." },
    or:          { vi: "Hoặc nhắn thẳng",     en: "Or message Kay directly" }
  },
  footerCol: {
    services: { vi: "Dịch vụ",    en: "Services" },
    brides:   { vi: "Cho cô dâu", en: "For brides" },
    tagline:  { vi: "Makeup cô dâu & trang điểm dự tiệc tại TP.HCM. Studio ở Phường Tân Hưng, nhận lịch toàn quốc.",
                en: "Bridal and event makeup in Ho Chi Minh City. Studio in Tân Hưng Ward, bookings nationwide." }
  },
  // 08/08/2026 (dot 3): khoi cong cu. 09/08/2026 (dot 5): chi con banner /lich-cuoi/
  // (the thu-look da go, the bang gia bi che "quê" — bo luon, bai gia co link o Journal).
  tools: {
    eyebrow: { vi: "Công cụ miễn phí", en: "Free tool" },
    heading: { vi: "Sắp cưới? Bắt đầu từ lộ trình", en: "Getting married? Start with the timeline" },
    t2: { vi: "Lịch đếm ngược ngày cưới", en: "Wedding countdown" },
    d2: { vi: "Nhập ngày cưới, nhận lộ trình riêng: mốc nào làm gì, còn bao nhiêu ngày.",
          en: "Enter your wedding date and get a personal beauty timeline — what to do, and when." },
    go2: { vi: "Xem lộ trình →", en: "See the timeline →" }
  },
  cta: {
    sticky: { vi: "Nhắn Zalo cho Kay", en: "Message Kay on Zalo" },
    stickyAlt: { vi: "Dịch vụ", en: "Services" },
    afterPriceText: {
      vi: "Ngày của bạn còn trống không? Nhắn Kay để nhận menu giá đầy đủ và giữ lịch.",
      en: "Is your date still open? Message Kay for the full price menu and to hold your slot."
    },
    afterPriceBtn: { vi: "Nhắn Zalo cho Kay", en: "Message Kay on Zalo" },
    afterPriceHint: {
      vi: "Zalo 0933 953 179 · Kay phản hồi trong ngày",
      en: "Zalo 0933 953 179 · Kay replies within the day"
    }
  },
  hero: {
    tagline: { vi: "a beauty atelier", en: "a beauty atelier" },
    sub: {
      vi: "Makeup cô dâu & trang điểm dự tiệc tại TP.HCM — sắc nét, sang, và vẫn là chính bạn.",
      en: "Bridal makeup & event hair styling in Ho Chi Minh City — sculpted, luxurious, and still unmistakably you."
    },
    cta: { vi: "Đặt lịch với Kay", en: "Book with Kay" },
    scroll: { vi: "Xem portfolio", en: "View portfolio" },
    masterclass: { vi: "Masterclass 1:1 · Đang mở lớp", en: "1:1 Masterclass · Now enrolling" }
  },
  credits: {
    heading: { vi: "Selected Credits", en: "Selected Credits" },
    // 08/08/2026: bắt buộc phải có dòng này. Dải tên trần đọc ra là "khách hàng / đối tác",
    // trong khi thực tế Kay tham gia với tư cách thành viên ekip hậu trường. Luật Quảng cáo 2012
    // Điều 8 cấm quảng cáo gây nhầm lẫn về uy tín và về tổ chức. Đây cũng là các nhãn hiệu
    // được bảo hộ — mô tả trung thực công việc đã làm thì được, gợi ý tài trợ hay hợp tác thì không.
    // Đừng xoá dòng này để trang gọn hơn.
    caption: {
      vi: "Kay tham gia ekip hậu trường tại",
      en: "Kay has worked backstage at"
    },
    // 01/09/2026: doi tu mang chuoi phang sang {vi,en} de dai credit khong con
    // dung nguyen tieng Viet khi bat EN. renderCredits() chap nhan CA HAI dang
    // (chuoi tran van chay), nen ten rieng khong can dich thi cu de nguyen chuoi.
    // Ten cuoc thi va ten nha thiet ke la danh tu rieng — chi dich cai nao co
    // ten quoc te chinh thuc, con lai giu nguyen.
    items: [
      "Miss Cosmo Vietnam",
      "Miss Cosmo International",
      { vi: "Hoa Hậu Việt Nam", en: "Miss Vietnam" },
      "Miss Grand Vietnam",
      "Aquafina Vietnam Int'l Fashion Week",
      "DCM Design",
      { vi: "Đỗ Long Design", en: "Đỗ Long Design" },
      { vi: "Adrian Anh Tuấn Shows", en: "Adrian Anh Tuấn Shows" },
      "Vietnam Wedding Fest"
    ]
  },
  approach: {
    heading: { vi: "The KINKAY Approach", en: "The KINKAY Approach" },
    intro: {
      vi: "Không có công thức chung cho mọi gương mặt. Chỉ có một cách làm đúng: bắt đầu từ chính bạn.",
      en: "There is no one formula for every face. Only one right way to work: start from you."
    },
    steps: [
      {
        name: "READ",
        title: { vi: "Đọc gương mặt", en: "Read the face" },
        body: {
          vi: "Trước khi chạm cọ, Kay đọc khuôn mặt: cấu trúc xương, tông da, nét nào là nét đắt giá nhất của bạn.",
          en: "Before the first brushstroke, Kay reads the face — bone structure, skin tone, and the feature that deserves the spotlight."
        }
      },
      {
        name: "SKIN",
        title: { vi: "Nền da là nền tảng", en: "Skin comes first" },
        body: {
          vi: "Da căng bóng, mỏng nhẹ, nhìn gần vẫn là da. Lớp nền đẹp nhất là lớp nền người ta không nhận ra.",
          en: "Luminous, weightless, still skin up close. The best base is the one nobody notices."
        }
      },
      {
        name: "SCULPT",
        title: { vi: "Sắc mà vẫn là mình", en: "Sculpted, still you" },
        body: {
          vi: "Đường nét sắc, có chiều sâu — nhưng soi gương bạn vẫn nhận ra chính mình, phiên bản tự tin nhất.",
          en: "Defined, dimensional features — yet the mirror still shows you, at your most confident."
        }
      }
    ]
  },
  portfolio: {
    heading: { vi: "Portfolio", en: "Portfolio" },
    all: { vi: "Tất cả", en: "All" }
  },
  services: {
    heading: { vi: "Dịch vụ", en: "Services" },
    note: {
      // 10/08/2026: gia da hien cong khai tren the dich vu, nen cau "nhan Kay de nhan menu"
      // khong con dung nua. Doi thanh: gia da o day, va tro thang sang bai giai thich gia.
      vi: "Studio tại Phường Tân Hưng, TP.HCM (by appointment) · Nhận lịch toàn quốc, phụ phí di chuyển báo trước khi xác nhận. Giá trên đã gồm dặm trong nội thành; xem <a href=\"/blog/gia-makeup-co-dau-tphcm\">bảng giá chi tiết và cách Kay tính giá</a>.",
      en: "Studio in Tân Hưng Ward, HCMC (by appointment) · Bookings nationwide, travel fee quoted before confirming. Prices above include touch-ups within the city; see the <a href=\"/blog/gia-makeup-co-dau-tphcm\">full price breakdown</a>."
    },
    items: [
      {
        title: { vi: "Full Glam Combo", en: "Full Glam Combo" },
        desc: {
          vi: "Makeup + tóc cho tiệc, sự kiện, chụp ảnh cá nhân. Tóc luôn đi cùng, không bán tách rời.",
          en: "Makeup + hair for events, parties and personal shoots. Hair always comes with it."
        }
      },
      // 01/09/2026: o "Hair Styling" DA BI THAY bang "Anh profile cong ty".
      // Ly do: the Hair Styling khong ban duoc gi — gia cua no ghi "Da co trong moi goi",
      // tuc no chiem mot trong bon o cua luoi ma khong dan toi doanh thu nao. Trang
      // /hair-styling/ VAN CON va van nam trong nav + footer nen khong mat URL.
      // Luoi la repeat(auto-fit, minmax(230px,1fr)): man 1280px cho 4 cot, nen phai giu
      // DUNG 4 o thi moi tron mot hang. Them o thu 5-6 la ra 4+2 mo coi. Da dung thu that
      // tren site truoc khi chot.
      // LUU Y: `title.en` o day la KHOA ghep voi `name` trong content/services.json
      // (build.js muc 4b-2, so sanh lowercase). Doi mot ben ma quen ben kia la the mat
      // gia va mat link, im lang, khong bao loi.
      {
        title: { vi: "Ảnh profile công ty", en: "Business profile photos" },
        desc: {
          vi: "Headshot cá nhân và chụp profile cả team. Grooming nam 900.000đ. Team nửa ngày 4.500.000đ.",
          en: "Business headshots and team profile shoots. Men's grooming 900,000 VND. Team half day 4,500,000 VND."
        }
      },
      {
        title: { vi: "Pre-wedding", en: "Pre-wedding" },
        desc: {
          vi: "Makeup và tóc cho buổi chụp ảnh cưới. Kay làm xong rồi về, hoặc đi theo cả buổi.",
          en: "Makeup and hair for the wedding shoot. Kay finishes and leaves, or stays the whole day."
        }
      },
      {
        title: { vi: "Bridal", en: "Bridal" },
        desc: {
          vi: "Ba mức chọn một: trọn ngày cưới, riêng lễ gia tiên, hoặc bà sui. Trial tính riêng.",
          en: "Three rates, choose one: the full wedding day, the ceremony alone, or the mothers. Trial charged separately."
        }
      }
    ]
  },
  about: {
    heading: { vi: "Về Kay", en: "About Kay" },
    body: {
      vi: "Kay bước ra từ hậu trường những sân khấu lớn — Miss Cosmo International, Hoa Hậu Việt Nam, Miss Grand Vietnam, cùng các show của Đỗ Long và Adrian Anh Tuấn. Được đào tạo tại Học viện Quân Nguyễn & Pu Lê và Ken Academy, Kay mang chuẩn mực khắt khe của sân khấu về từng gương mặt khách của KINKAY.\n\nPhong cách của Kay là glam tiết chế: nền da căng mịn, nhìn gần vẫn là da; đường nét sắc nhưng vẫn tự nhiên. Kay không biến bạn thành người khác — chỉ làm bạn hiện lên rõ nét và tự tin hơn.\n\nNgồi vào ghế KINKAY, bạn nhận được tư vấn thật — bằng con mắt nghề và kinh nghiệm, không chạy theo xu hướng. Kay đọc gương mặt bạn trước khi chạm cọ, để giữ lại đúng nét đẹp riêng của bạn.",
      en: "Kay comes from backstage at some of the biggest stages — Miss Cosmo International, Miss Vietnam, Miss Grand Vietnam, and runway shows for Đỗ Long and Adrian Anh Tuấn. Trained at Quân Nguyễn & Pu Lê Academy and Ken Academy, she brings that stage-level standard to every face in the KINKAY chair.\n\nHer signature is restrained glam: a fresh base that still looks like skin up close, and definition that stays natural. Kay will not turn you into someone else — only a sharper, more confident version of yourself.\n\nIn the KINKAY chair, you get honest advice — built on a trained eye and real experience, never on passing trends. She reads your face before the first brushstroke, to keep exactly what makes you, you."
    },
    quote: {
      vi: "“Nét đẹp của bạn vốn đã có sẵn. Việc của Kay là làm cho người ta nhìn thấy nó — rõ hơn, và đúng chất bạn hơn.”",
      en: "“Your beauty is already there. My job is simply to let people see it — clearer, and more like you.”"
    },
    sign: { vi: "— Kay, founder", en: "— Kay, founder" }
  },
  masterclass: {
    badge: { vi: "Đang nhận học viên · Masterclass 1:1", en: "Now enrolling · 1:1 Masterclass" },
    eyebrow: { vi: "KINKAY Education", en: "KINKAY Education" },
    heading: { vi: "Personal Makeup Masterclass", en: "Personal Makeup Masterclass" },
    intro: {
      vi: "Học 1 kèm 1 trực tiếp với Kay — lộ trình cá nhân hóa theo đúng trình độ, gương mặt và mục tiêu của bạn.",
      en: "Learn one-to-one with Kay — a personalized path built around your level, your face and your goals."
    },
    p1: { vi: "1 kèm 1, dạy trực tiếp bởi Kay", en: "One-to-one, taught by Kay herself" },
    p2: { vi: "Lộ trình cá nhân hóa theo trình độ", en: "A path built around your level" },
    // 01/09/2026: lop gio la 5 buoi 2-3h, hoc tren chinh guong mat hoc vien (khong con mau that).
    p3: { vi: "5 buổi, 2–3 giờ mỗi buổi", en: "5 sessions, 2–3 hours each" },
    p4: { vi: "Học trên chính gương mặt bạn, dùng mỹ phẩm của lớp", en: "Learn on your own face, using the studio's kit" },
    cta: { vi: "Xem lộ trình & học phí", en: "See curriculum & tuition" },
    cta2: { vi: "Đăng ký giữ chỗ", en: "Reserve a seat" }
  },
  testimonials: {
    heading: { vi: "Khách nói về Kay", en: "What Clients Say" },
    note: { vi: "Trích nguyên văn tin nhắn khách gửi Kay", en: "Real messages sent to Kay, word for word" },
    // 09/08/2026 (dot 5): CTA sang review Google — thay cho y tuong comment tren web.
    gcta: { vi: "Bạn từng make với Kay? Để lại đánh giá trên Google →", en: "Had your makeup done by Kay? Leave a Google review →" },
    items: [
      {
        quote: {
          vi: "“Make kiểu gì mà xuống khách sạn người ta tưởng tui hoa hậu, chạy tới xin chụp hình.”",
          en: "“What did you even do — people at the hotel thought I was a pageant queen and ran over asking for photos.”"
        },
        who: { vi: "Khách makeup sự kiện", en: "Event makeup client" }
      },
      {
        quote: {
          vi: "“Cảm ơn bà Kin Kay đã cho tui với mẹ tui những bộ tóc đẹp trong ngày đám cưới của tui.”",
          en: "“Thank you Kin Kay for giving me and my mom the most beautiful hair on my wedding day.”"
        },
        who: { vi: "Cô dâu — bridal hair", en: "Bride — bridal hair" }
      },
      {
        quote: {
          vi: "“Ai cũng nhìn, ai cũng khen. Quá đã.”",
          en: "“Everyone looked, everyone complimented. So worth it.”"
        },
        who: { vi: "Khách makeup tiệc", en: "Party makeup client" }
      }
    ]
  },
  kit: {
    heading: { vi: "Kay's Kit", en: "Kay's Kit" },
    sub: {
      vi: "Những thương hiệu luôn có trong túi đồ nghề của Kay.",
      en: "The brands always inside Kay's professional kit."
    },
    items: ["NARS", "M·A·C", "Charlotte Tilbury", "YSL Beauty", "Tom Ford", "Chanel", "Bobbi Brown", "Clinique"]
  },
  videos: {
    heading: { vi: "Behind the Glam", en: "Behind the Glam" },
    sub: {
      vi: "Kay trong hậu trường — cùng nghệ sĩ và khách của KINKAY.",
      en: "Kay backstage — with KINKAY's artists and clients."
    },
    items: [
      { src: "assets/video/video_01.mp4", poster: "assets/video/poster_01.jpg" },
      { src: "assets/video/video_02.mp4", poster: "assets/video/poster_02.jpg" },
      { src: "assets/video/video_03.mp4", poster: "assets/video/poster_03.jpg" },
      { src: "assets/video/video_04.mp4", poster: "assets/video/poster_04.jpg" },
      { src: "assets/video/video_05.mp4", poster: "assets/video/poster_05.jpg" }
    ]
  },
  journal: {
    heading: { vi: "Journal", en: "Journal" },
    sub: { vi: "Bí quyết makeup, hậu trường show và guide cho cô dâu — từ ghế làm việc của Kay.", en: "Makeup know-how, backstage stories and bridal guides — straight from Kay's chair." },
    all: { vi: "Xem tất cả bài viết", en: "View all posts" }
  },
  booking: {
    heading: { vi: "Đặt lịch", en: "Book a Session" },
    sub: {
      vi: "Nhắn Kay ngày, giờ và dịp của bạn. Kay phản hồi trong ngày.",
      en: "Send Kay your date, time and occasion. She replies within the day."
    },
    cta: { vi: "Nhắn Zalo cho Kay", en: "Message Kay on Zalo" },
    cta2: { vi: "Hoặc nhắn Instagram", en: "Or message on Instagram" },
    hint: { vi: "Zalo 0933 953 179 — Kay trả lời nhanh nhất ở đây", en: "Zalo 0933 953 179 — fastest way to reach Kay" },
    channels: [
      { label: "Zalo", href: "https://zalo.me/0933953179", handle: "0933 953 179" },
      { label: "Instagram", href: "https://instagram.com/kinkay.official", handle: "@kinkay.official" },
      { label: "TikTok", href: "https://tiktok.com/@kinkay.official", handle: "@kinkay.official" },
      { label: "Facebook", href: "https://www.facebook.com/missTram.99/", handle: "Kin Kay" },
      { label: "Email", href: "mailto:kinkay20t@gmail.com", handle: "kinkay20t@gmail.com" }
    ]
  },
  footer: {
    line: { vi: "KINKAY · a beauty atelier · HCMC", en: "KINKAY · a beauty atelier · HCMC" },

    // 08/08/2026 — Nghị định 52/2013 Điều 27: website thương mại điện tử bán hàng phải công bố
    // tên, địa chỉ, số điện thoại của chủ sở hữu. Trước đó footer chỉ có đúng một dòng thương hiệu.
    //
    // Tân cung cấp 08/08/2026: Thạch Bé Trâm. Dấu tiếng Việt do em thêm — Tân đối chiếu CCCD, khác thì sửa.
    // Sửa ở đúng một chỗ này, tất cả các trang tự cập nhật theo.
    //
    // Khi nào có đăng ký hộ kinh doanh thì đổi dòng owner thành tên hộ KD + số ĐKKD + MST,
    // rồi mới thông báo website với Bộ Công Thương tại online.gov.vn được.
    owner: {
      vi: "Chủ sở hữu website: Thạch Bé Trâm · Studio: Phường Tân Hưng, TP.HCM · 0933 953 179 · kinkay20t@gmail.com",
      en: "Website owner: Thạch Bé Trâm · Studio: Tan Hung Ward, HCMC · 0933 953 179 · kinkay20t@gmail.com"
    },
    privacy: { vi: "Chính sách dữ liệu", en: "Data policy" },
    terms:   { vi: "Điều khoản dịch vụ", en: "Terms of service" }
  }
};
