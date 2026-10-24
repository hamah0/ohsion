/* =========================================================
   오시온의 휴대폰 — SHOW 포털 (2009년풍 모바일 포털)

   ※ 실제 인터넷에 연결하지 않아요. 뉴스·게임·벨소리·생활정보는 제목만 보이고,
     날씨는 2009년 12월 25일(성탄절) 기록과 26일 예보예요
     (한국일보 2009.12.28 기사 속 기상청 발표 기준).

   ▶ 페이지 종류
     목록:  { title, note, items: [ { label, sub, page: {...} } ] }
            (page 가 없는 항목은 제목만 보이는 줄이에요)
     글:    { title, note, body: `내용` }
     이미지:{ title, art: "그림이름", body: `설명` }   (그림은 아래 SHOW_ART)
     검색:  { type: "search", title, popular: [...] }
   ▶ 항목에 page 대신 action 을 쓰면 휴대폰 기능으로 이동해요
     action: "music"   → 휴대폰 뮤직 플레이어 목록
     action: "music:3" → 뮤직 플레이어 3번 곡 화면
   ========================================================= */

const SHOW_PORTAL = {
  greeting: "SHOW에 오신 것을 환영합니다",

  home: [
    { label: "검색", icon: "◎", page: { type: "search", title: "검색",
        popular: ["크리스마스", "날씨", "운세", "벨소리", "게임", "방학"] } },

    { label: "뉴스", icon: "▣", page: { title: "뉴스", items: [
      { label: "크리스마스이브, 거리마다 성탄 분위기" },
      { label: "주말 한파 예상…빙판길 조심" },
      { label: "겨울방학, 놀이공원·스키장 북적" },
      { label: "연말 공연가, 성탄 특집 무대 이어져" },
      { label: "수험생 겨울방학, 이렇게 보내요" },
    ] } },

    { label: "날씨", icon: "☼", page: { title: "날씨", note: "자료: 기상청 (12월 25일 성탄절 · 26일 예보)", items: [
      { label: "서울", page: { title: "서울 날씨", body: `25일(금) 성탄절\n황사주의보 · 저녁 눈\n\n26일(토)\n아침 최저 -7℃\n강한 추위 28일까지` } },
      { label: "경기·인천", page: { title: "경기·인천 날씨", body: `25일(금) 성탄절\n인천·김포 황사경보\n경기 황사주의보\n\n26일(토)\n인천 아침 최저 -6℃` } },
      { label: "강원", page: { title: "강원 날씨", body: `26일(토)\n대관령 아침 최저 -11℃\n황사 중부지방까지 확산` } },
      { label: "충청", page: { title: "충청 날씨", body: `25일(금) 성탄절\n대전·충남 황사주의보\n\n26일(토)\n대전 아침 최저 -3℃` } },
      { label: "전라", page: { title: "전라 날씨", body: `25일(금) 성탄절\n호남 서해안 황사주의보\n\n26일(토)\n광주 아침 최저 -2℃` } },
      { label: "경상", page: { title: "경상 날씨", body: `26일(토)\n황사 남부지방까지 확산\n대구 아침 최저 -2℃` } },
    ] } },

    { label: "운세", icon: "★", page: { title: "오늘의 운세", note: "띠를 골라 보세요 (재미로 보는 운세)", items: [
      { label: "쥐띠", sub: "84·96년생", page: { title: "쥐띠 오늘의 운세", body: `총운: 작은 일에도 웃을 일이 생겨요.\n애정운: 먼저 건넨 한마디가 분위기를 바꿔요.\n행운의 색: 하늘색` } },
      { label: "소띠", sub: "85·97년생", page: { title: "소띠 오늘의 운세", body: `총운: 서두르지 않으면 다 잘 풀려요.\n애정운: 늘 곁에 있던 사람을 다시 보게 돼요.\n행운의 색: 갈색` } },
      { label: "호랑이띠", sub: "86·98년생", page: { title: "호랑이띠 오늘의 운세", body: `총운: 미뤄 둔 일을 끝내기 좋은 날.\n애정운: 솔직한 마음이 통해요.\n행운의 색: 주황` } },
      { label: "토끼띠", sub: "87·99년생", page: { title: "토끼띠 오늘의 운세", body: `총운: 반가운 연락이 와요.\n애정운: 망설이면 기회가 지나가요.\n행운의 색: 분홍` } },
      { label: "용띠", sub: "88·00년생", page: { title: "용띠 오늘의 운세", body: `총운: 자신감이 행운을 불러요.\n애정운: 작은 선물이 큰 기쁨이 돼요.\n행운의 색: 금색` } },
      { label: "뱀띠", sub: "89·01년생", page: { title: "뱀띠 오늘의 운세", body: `총운: 조용히 준비한 것이 빛을 봐요.\n애정운: 천천히 다가가는 게 좋아요.\n행운의 색: 초록` } },
      { label: "말띠", sub: "90·02년생", page: { title: "말띠 오늘의 운세", body: `총운: 몸을 움직이면 기분도 좋아져요.\n애정운: 함께 걷는 시간이 소중해요.\n행운의 색: 빨강` } },
      { label: "양띠", sub: "91·03년생", page: { title: "양띠 오늘의 운세", body: `총운: 주변의 도움을 받는 날.\n애정운: 따뜻한 말 한마디면 충분해요.\n행운의 색: 흰색` } },
      { label: "원숭이띠", sub: "92·04년생", page: { title: "원숭이띠 오늘의 운세", body: `총운: 재치 있는 생각이 통해요.\n애정운: 장난 속에 진심이 숨어 있어요.\n행운의 색: 노랑` } },
      { label: "닭띠", sub: "93·05년생", page: { title: "닭띠 오늘의 운세", body: `총운: 아침 일찍 시작하면 좋아요.\n애정운: 기다리던 소식이 들려요.\n행운의 색: 보라` } },
      { label: "개띠", sub: "94·06년생", page: { title: "개띠 오늘의 운세", body: `총운: 믿음직한 모습이 인정받아요.\n애정운: 지켜 주고 싶은 마음이 커져요.\n행운의 색: 남색` } },
      { label: "돼지띠", sub: "95·07년생", page: { title: "돼지띠 오늘의 운세", body: `총운: 맛있는 걸 먹으면 운이 올라요.\n애정운: 함께 웃는 시간이 늘어나요.\n행운의 색: 연두` } },
    ] } },

    { label: "음악", icon: "♪", page: { title: "SHOW 뮤직", items: [
      { label: "내 폰 뮤직 플레이어 열기", sub: "저장된 곡 듣기", action: "music" },
      { label: "추천곡", sub: "내 폰에 저장된 곡", page: { title: "추천곡", note: "선택하면 뮤직 플레이어로 이동해요", items: "MUSIC_LIST" } },
      { label: "뮤직 이용 안내", page: { title: "뮤직 이용 안내",
        body: `곡 듣기는 휴대폰의 뮤직 플레이어에서 할 수 있어요.\n\n메뉴 → 음악 → 곡 선택 → 재생` } },
    ] } },

    { label: "게임", icon: "◆", page: { title: "게임", items: [
      { label: "벽돌깨기 클래식", sub: "액션" },
      { label: "맞고 한판", sub: "보드" },
      { label: "미니 사커 09", sub: "스포츠" },
      { label: "바다낚시왕", sub: "캐주얼" },
      { label: "두더지 퐁퐁", sub: "캐주얼" },
      { label: "스노우 보더", sub: "스포츠" },
    ] } },

    { label: "벨소리", icon: "☏", page: { title: "벨소리", items: [
      { label: "징글벨 (64화음)", sub: "시즌" },
      { label: "엘리제를 위하여", sub: "클래식 벨" },
      { label: "캐논 변주곡", sub: "클래식 벨" },
      { label: "따르릉 옛날전화", sub: "효과음" },
      { label: "뾰로롱 문자음", sub: "문자 알림음" },
    ] } },

    { label: "사진·이미지", icon: "▤", page: { title: "사진·이미지", items: [
      { label: "크리스마스 트리", sub: "배경화면", page: { title: "크리스마스 트리", art: "tree", body: `반짝반짝 겨울 배경화면.` } },
      { label: "눈 내리는 밤", sub: "배경화면", page: { title: "눈 내리는 밤", art: "snow", body: `조용히 눈 내리는 밤.` } },
      { label: "하트 뿅뿅", sub: "캐릭터", page: { title: "하트 뿅뿅", art: "heart", body: `문자 보낼 때 어울리는 하트.` } },
      { label: "별 반짝", sub: "캐릭터", page: { title: "별 반짝", art: "star", body: `작고 반짝이는 별.` } },
      { label: "눈사람", sub: "캐릭터", page: { title: "눈사람", art: "snowman", body: `겨울 한정 눈사람 친구.` } },
    ] } },

    { label: "생활정보", icon: "♣", page: { title: "생활정보", items: [
      { label: "겨울철 수도 동파 예방" },
      { label: "감기 예방 수칙" },
      { label: "빙판길 걷는 요령" },
      { label: "선물 포장 팁" },
      { label: "알아 두면 좋은 번호" },
    ] } },
  ],
};

/* 사진·이미지용 픽셀 그림 (한 글자 = 한 칸)
   . 빈칸  g 초록  y 노랑  r 빨강  w 흰색  b 파랑  n 남색  k 갈색  o 주황 */
const SHOW_ART = {
  tree: [
    "nnnnnnyynnnnnn", "nnnnnyyyynnnnn", "nnnnnnggnnnnnn", "nnnnngggrnnnnn", "nnnngrgggngnnn",
    "nnnnggggggnnnn", "nnnggyggrgggnn", "nnggggggggggnn", "nngrgggyggggrn", "nggggggggggggn",
    "nnnnnnkknnnnnn", "nnnnnnkknnnnnn", "wwwwwwwwwwwwww", "wwwwwwwwwwwwww",
  ],
  snow: [
    "nnnwnnnnnnnwnn", "nnnnnnnwnnnnnn", "nwnnnnnnnnwnnn", "nnnnnwnnnnnnnw", "nnnnnnnnnwnnnn",
    "nnwnnnnwnnnnnn", "nnnnnnnnnnnwnn", "nnnnwnnnnnnnnn", "wnnnnnnnwnnnnn", "nnnnnnwnnnnnwn",
    "nnnyynnnnnyynn", "nnnyynnnnnyynn", "wwwwwwwwwwwwww", "wwwwwwwwwwwwww",
  ],
  heart: [
    "..............", "...rr....rr...", "..rrrr..rrrr..", ".rrwrrrrrrrrr.", ".rrrrrrrrrrrr.",
    ".rrrrrrrrrrrr.", "..rrrrrrrrrr..", "...rrrrrrrr...", "....rrrrrr....", ".....rrrr.....",
    "......rr......", "..............",
  ],
  star: [
    "......yy......", "......yy......", ".....yyyy.....", "yyyyyyyyyyyyyy", ".yyyyyyyyyyyy.",
    "..yyyyyyyyyy..", "...yyyyyyyy...", "...yyyyyyyy...", "..yyyy..yyyy..", "..yyy....yyy..",
    ".yy........yy.",
  ],
  snowman: [
    ".....kkkk.....", ".....kkkk.....", "....kkkkkk....", ".....wwww.....", "....wnwwnw....",
    "....wwowww....", ".....wwww.....", "...rrrrrrrr...", "...wwwwwwww...", "..wwwwnwwwww..",
    "..wwwwwwwwww..", "..wwwwnwwwww..", "...wwwwwwww...",
  ],
};
