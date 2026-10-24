/* =========================================================
   오시온의 휴대폰 — 뮤직 플레이어 곡 목록

   ※ 실제 소리는 나오지 않아요. 재생 버튼을 누르면 화면(재생바·시간)만
     진짜 음악 플레이어처럼 움직여요. 외부 사이트 연결 없음.

   ▶ 곡 추가: 아래 형식으로 한 줄 복사해서 붙이고 내용만 바꾸면 돼요.
       { title: "곡 제목", artist: "가수", length: "03:45" },

   ▶ length: 곡 길이 "분:초". 비워 두면 04:00 으로 표시돼요.
   ▶ 목록 순서 = 이 파일에 적힌 순서 (1번부터)
   ========================================================= */

const MUSIC = [
  { title: "Milky Way",                artist: "보아",                      length: "03:20" }, // 위키백과 기준
  { title: "Fly",                      artist: "에픽하이",                  length: "03:22" }, // 위키백과 기준
  { title: "Miracle",                  artist: "슈퍼주니어",                length: "02:56" }, // 위키백과 기준
  { title: "Lollipop",                 artist: "빅뱅, 2NE1",                length: "03:08" }, // 위키백과 기준
  { title: "Loveholic",                artist: "러브홀릭",                  length: "04:00" }, // 기본 길이 (실제 길이 미확인)
  { title: "내 입술... 따뜻한 커피처럼", artist: "샵",                      length: "04:10" }, // 기본 길이 (실제 길이 미확인)
  { title: "응급실",                   artist: "izi",                       length: "04:30" }, // 기본 길이 (실제 길이 미확인)
  { title: "I Think I",                artist: "별",                        length: "03:50" }, // 기본 길이 (실제 길이 미확인)
  { title: "다줄께 (Feat. 송지은)",     artist: "언터쳐블",                  length: "03:40" }, // 기본 길이 (실제 길이 미확인)
  { title: "Must Have Love",           artist: "브라운아이드걸스, SG워너비", length: "04:17" }, // MusicBrainz 기준
  { title: "여우야",                   artist: "더 클래식",                 length: "04:20" }, // 기본 길이 (실제 길이 미확인)
  { title: "Sky High",                 artist: "FreeTEMPO",                 length: "05:00" }, // 기본 길이 (실제 길이 미확인)
  { title: "love love love",           artist: "에픽하이",                  length: "03:51" },
  { title: "Snow Prince",              artist: "SS501",                     length: "03:25" },
  { title: "Show me your love",        artist: "동방신기, 슈퍼주니어",      length: "04:07" },
  { title: "좋을텐데",                 artist: "성시경",                    length: "04:09" },
  { title: "나비무덤",                 artist: "테이크",                    length: "04:30" },
  { title: "죽일 놈 (Guilty)",         artist: "다이나믹듀오",              length: "03:43" },
  { title: "Ballerino (Feat. ALI)",    artist: "리쌍",                      length: "04:27" },
  { title: "들리나요...",              artist: "태연",                      length: "04:01" },
  { title: "Perhaps Love (사랑인가요)", artist: "제이, 하울",               length: "04:35" },
  { title: "가져가",                   artist: "원더걸스",                  length: "03:44" },
  { title: "믿어요",                   artist: "동방신기",                  length: "04:51" },
  { title: "Lady",                     artist: "빅뱅",                      length: "03:24" },
];
