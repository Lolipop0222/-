/**
 * 2026년 11월 대전고 식단표 (조식·중식·석식).
 * 학교에서 받은 한글 파일(2026.11 식단표)을 옮겨 적은 것. allergens는 알레르기 유발 식품 번호(docs/NEIS_API.md 4-2).
 * 평소에는 NEIS에서 받아오고(lib/neis.ts), NEIS가 안 되거나 비어 있을 때 이 데이터를 쓴다.
 */

export type Dish = { name: string; allergens?: number[] };
export type Meal = { dishes: Dish[]; kcal?: number; note?: string };
export type MealDay = { breakfast?: Meal; lunch?: Meal; dinner?: Meal };

/** /api/meals/[month] 응답. source: 어디서 가져왔는지 */
export type MealsResponse = { source: "neis" | "file" | "none"; meals: Record<string, MealDay> };

export const MEAL_LABEL = { breakfast: "조식", lunch: "중식", dinner: "석식" } as const;

/** 알레르기 유발 식품 번호 (NEIS 기준) */
export const ALLERGENS: Record<number, string> = {
  1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두", 6: "밀", 7: "고등어", 8: "게", 9: "새우", 10: "돼지고기",
  11: "복숭아", 12: "토마토", 13: "아황산류", 14: "호두", 15: "닭고기", 16: "쇠고기", 17: "오징어", 18: "조개류", 19: "잣",
};

export const meals: Record<string, MealDay> = {
  "2026-11-02": {
    lunch: {
      dishes: [{ name: "제육덮밥", allergens: [5, 6, 10, 13] }, { name: "미소된장국", allergens: [5, 6] }, { name: "야채달걀찜", allergens: [1] }, { name: "들깨무나물" }, { name: "깍두기", allergens: [9] }, { name: "사과주스" }],
      kcal: 948,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "짬뽕순두부찌개", allergens: [5, 6, 9, 13, 17, 18] }, { name: "미트볼떡조림", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16] }, { name: "부추콩나물무침", allergens: [5, 13] }, { name: "배추김치", allergens: [9] }],
      kcal: 852,
    },
  },
  "2026-11-03": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "미니크로와상", allergens: [1, 2, 5, 6] }, { name: "아욱감자국", allergens: [5, 6] }, { name: "참치김치볶음", allergens: [5, 6, 9, 13, 16, 18] }, { name: "구운김" }, { name: "마늘햄구이", allergens: [1, 2, 5, 6, 10, 15, 16] }],
      kcal: 934,
    },
    lunch: {
      dishes: [{ name: "찹쌀밥" }, { name: "유부우동", allergens: [1, 2, 5, 6, 7, 9, 18] }, { name: "등심돈까스&소스", allergens: [1, 2, 5, 6, 10, 12, 13, 16, 18] }, { name: "배추김치", allergens: [9] }, { name: "마카로니샐러드", allergens: [1, 2, 5, 6, 8, 10, 13, 15, 16] }],
      kcal: 960,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "도토리묵채국", allergens: [5, 6, 9] }, { name: "청경채나물" }, { name: "치킨윙오븐구이", allergens: [5, 6, 12, 13, 15] }, { name: "알타리김치", allergens: [9] }],
      kcal: 910,
    },
  },
  "2026-11-04": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "홍합살미역국", allergens: [18] }, { name: "소떡소떡볶음", allergens: [2, 5, 6, 10, 12, 13, 15, 16] }, { name: "애호박새우젓볶음", allergens: [5, 9] }, { name: "오이소박이", allergens: [9] }],
      kcal: 941,
    },
    lunch: {
      dishes: [{ name: "찰보리밥" }, { name: "얼큰무국", allergens: [5, 6] }, { name: "돈육김치찜", allergens: [5, 6, 9, 10, 13] }, { name: "알타리김치", allergens: [9] }, { name: "돌김자반", allergens: [5] }],
      kcal: 948,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "순대국", allergens: [2, 5, 6, 9, 10, 13, 16] }, { name: "아삭이고추무침", allergens: [5, 6] }, { name: "야채고기완자전", allergens: [1, 2, 5, 6, 10, 12, 15, 16] }, { name: "석박지", allergens: [9] }],
      kcal: 907,
    },
  },
  "2026-11-05": {
    breakfast: {
      dishes: [{ name: "후리가케밥", allergens: [1, 2, 5, 6, 9, 13, 16, 18] }, { name: "감자샐러드", allergens: [1, 5, 13] }, { name: "통닭다리살스테이크", allergens: [2, 5, 6, 12, 15] }, { name: "동치미", allergens: [9] }, { name: "시리얼&우유", allergens: [2, 5, 6] }],
      kcal: 864,
    },
    lunch: {
      dishes: [{ name: "찰옥수수밥" }, { name: "부대찌개", allergens: [1, 2, 5, 6, 9, 10, 12, 13, 15, 16, 18] }, { name: "청경채나물" }, { name: "돈육불고기", allergens: [5, 6, 10, 13] }, { name: "깍두기", allergens: [9] }],
      kcal: 964,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼큰닭개장", allergens: [5, 6, 15] }, { name: "시금치나물" }, { name: "함박스테이크", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16] }, { name: "배추김치", allergens: [9] }, { name: "고구마범벅", allergens: [1, 2, 5, 6, 13] }],
      kcal: 916,
    },
  },
  "2026-11-06": {
    breakfast: {
      dishes: [{ name: "크림스프", allergens: [2, 5, 6, 13, 16] }, { name: "모닝빵&딸기잼", allergens: [1, 2, 5, 6, 13] }, { name: "스크램블드에그", allergens: [1, 2, 5, 6, 10, 15, 16] }, { name: "통소시지구이", allergens: [2, 5, 6, 10, 12, 15, 16] }, { name: "떠먹는요거트", allergens: [2] }],
      kcal: 941,
    },
    lunch: {
      dishes: [{ name: "짜장덮밥", allergens: [5, 6, 10, 13, 16, 18] }, { name: "계란실파국", allergens: [1, 5, 6] }, { name: "만두&비빔야채", allergens: [1, 5, 6, 10, 13, 16, 18] }, { name: "배추김치", allergens: [9] }, { name: "붕어빵", allergens: [1, 2, 5, 6, 16] }],
      kcal: 970,
    },
    dinner: {
      dishes: [{ name: "후리가케밥", allergens: [1, 2, 5, 6, 9, 13, 16, 18] }, { name: "돈코츠라멘", allergens: [1, 2, 5, 6, 10, 15, 16] }, { name: "반달단무지" }, { name: "타코야끼", allergens: [1, 2, 5, 6, 7, 13, 18] }, { name: "군옥수수맛아몬드", allergens: [2, 5] }],
      kcal: 959,
    },
  },
  "2026-11-07": {
    breakfast: {
      dishes: [{ name: "간장계란밥", allergens: [1, 2, 5, 6, 9, 13, 16, 18] }, { name: "두부김치국", allergens: [5, 9] }, { name: "너비아니구이", allergens: [1, 2, 5, 6, 10, 13, 15, 16, 18] }, { name: "깍두기", allergens: [9] }, { name: "미니도넛", allergens: [1, 2, 5, 6] }],
      kcal: 910,
    },
    lunch: {
      dishes: [{ name: "매운치킨버거", allergens: [1, 2, 5, 6, 12, 15] }, { name: "무피클" }, { name: "콘샐러드", allergens: [1, 2, 5, 6, 10, 13, 15, 16] }, { name: "감자튀김&케첩", allergens: [1, 2, 5, 6, 12] }, { name: "쿨피스", allergens: [2] }],
      kcal: 954,
    },
  },
  "2026-11-09": {
    lunch: {
      dishes: [{ name: "기장밥" }, { name: "한방닭곰탕", allergens: [13, 15] }, { name: "부추콩나물무침", allergens: [5, 13] }, { name: "매콤주꾸미볶음&소면사리", allergens: [5, 6, 13] }, { name: "깍두기", allergens: [9] }],
      kcal: 972,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "참치김치찌개", allergens: [5, 6, 9, 16, 18] }, { name: "삼색달걀말이", allergens: [1, 5] }, { name: "모듬캠핑샘플러", allergens: [2, 5, 6, 10, 13, 15, 16] }, { name: "깍두기", allergens: [9] }],
      kcal: 852,
    },
  },
  "2026-11-10": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "조랭이떡국", allergens: [1, 5, 6, 16] }, { name: "비엔나야채볶음", allergens: [2, 5, 6, 10, 12, 15, 16] }, { name: "햄감자채볶음", allergens: [1, 2, 5, 6, 10, 15, 16] }, { name: "배추김치", allergens: [9] }, { name: "사과1쪽" }],
      kcal: 926,
    },
    lunch: {
      dishes: [{ name: "찰흑미밥" }, { name: "순두부찌개", allergens: [5, 6, 9, 10, 17, 18] }, { name: "부추양파무침", allergens: [13] }, { name: "오리불고기", allergens: [2, 5, 6, 13] }, { name: "깍두기", allergens: [9] }],
      kcal: 974,
    },
    dinner: {
      dishes: [{ name: "오므라이스(데미소스)", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16, 18] }, { name: "얼큰콩나물국", allergens: [5] }, { name: "회오리감자", allergens: [5, 6] }, { name: "배추김치", allergens: [9] }, { name: "요구르트", allergens: [13] }],
      kcal: 847,
    },
  },
  "2026-11-11": {
    breakfast: {
      dishes: [{ name: "한우소고기야채죽", allergens: [16] }, { name: "무장아찌무침", allergens: [13] }, { name: "치즈콕언양식갈비", allergens: [1, 2, 5, 6, 10, 12, 15, 16] }, { name: "배추김치", allergens: [9] }, { name: "장건강요구르트", allergens: [2] }],
      kcal: 891,
    },
    lunch: {
      dishes: [{ name: "돈마호크스테이크", allergens: [2, 5, 6, 10, 13] }, { name: "토마토파스타", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16] }, { name: "브로콜리크림스프", allergens: [2, 5, 6, 13, 16] }, { name: "오이피클" }, { name: "마늘바게트", allergens: [1, 2, 5, 6] }],
      kcal: 974,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼큰시래기장국", allergens: [5, 6] }, { name: "오리훈제*머스타드소스", allergens: [1, 2, 5, 6] }, { name: "매콤어묵볶음", allergens: [1, 5, 6, 13] }, { name: "배추김치", allergens: [9] }, { name: "무쌈" }],
      kcal: 875,
    },
  },
  "2026-11-12": {
    breakfast: {
      dishes: [{ name: "유부볶음밥", allergens: [1, 2, 5, 6, 9, 13, 16, 18] }, { name: "치킨텐더샐러드&머스터드", allergens: [1, 2, 5, 6, 15] }, { name: "볶음김치", allergens: [9] }, { name: "시리얼&우유", allergens: [2, 5, 6] }],
      kcal: 881,
    },
    lunch: {
      dishes: [{ name: "찹쌀밥" }, { name: "설렁탕/당면사리", allergens: [5, 6, 13, 16] }, { name: "꼬들오이지무침" }, { name: "메밀전병", allergens: [2, 3, 5, 6, 16, 18] }, { name: "석박지", allergens: [9] }, { name: "초코그레인롤", allergens: [1, 2, 5, 6, 14] }],
      kcal: 963,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼갈이된장국", allergens: [5, 6] }, { name: "백순대야채볶음", allergens: [2, 5, 6, 10, 13, 16] }, { name: "애호박새송이볶음", allergens: [5] }, { name: "배추김치", allergens: [9] }],
      kcal: 876,
    },
  },
  "2026-11-13": {
    breakfast: {
      dishes: [{ name: "수제불고기핫도그", allergens: [1, 2, 5, 6, 10, 12, 13, 18] }, { name: "콘샐러드", allergens: [1, 2, 5, 6, 10, 13, 15, 16] }, { name: "딸바라떼", allergens: [2] }, { name: "바나나" }, { name: "웨지감자구이", allergens: [5] }],
      kcal: 957,
    },
    lunch: {
      dishes: [{ name: "찰옥수수밥" }, { name: "두부호박된장찌개", allergens: [5, 6] }, { name: "숙주나물무침" }, { name: "숯불고추장불고기", allergens: [5, 6, 10, 12, 13] }, { name: "배추김치", allergens: [9] }],
      kcal: 959,
    },
    dinner: {
      dishes: [{ name: "햄마요비빔밥", allergens: [1, 2, 5, 6, 9, 10, 13, 15, 16] }, { name: "쑥갓어묵국", allergens: [1, 5, 6] }, { name: "반달단무지" }, { name: "옛날국물떡볶이", allergens: [1, 2, 5, 6, 10, 13, 15, 16] }, { name: "김말이튀김", allergens: [1, 2, 5, 6, 16] }],
      kcal: 956,
    },
  },
  "2026-11-14": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "미소된장국", allergens: [5, 6] }, { name: "연어스테이크&사과소스", allergens: [1, 5, 6, 12, 13] }, { name: "배추김치", allergens: [9] }, { name: "조각파인애플" }],
      kcal: 899,
    },
    lunch: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼큰우동장국", allergens: [1, 2, 5, 6, 7, 9, 13, 18] }, { name: "푸실리샐러드", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16] }, { name: "새우까스&타르타르소스", allergens: [1, 5, 6, 9, 13] }, { name: "배추김치", allergens: [9] }],
      kcal: 967,
    },
  },
  "2026-11-16": {
    lunch: {
      dishes: [{ name: "15곡혼합밥", allergens: [5] }, { name: "새콤달콤쫄면", allergens: [5, 6, 13] }, { name: "얼큰무국", allergens: [5, 6] }, { name: "보쌈김치", allergens: [9] }, { name: "수육&상추쌈", allergens: [5, 6, 10, 13] }],
      kcal: 953,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "물만두국", allergens: [1, 5, 6, 10, 16, 18] }, { name: "궁중떡볶이", allergens: [5, 6, 13, 16, 18] }, { name: "마늘쫑햄볶음", allergens: [1, 2, 5, 6, 10, 13, 15, 16] }, { name: "배추김치", allergens: [9] }],
      kcal: 943,
    },
  },
  "2026-11-17": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "근대된장국", allergens: [5, 6] }, { name: "샐러드&수제황도요거트", allergens: [2, 11] }, { name: "치즈함박스테이크", allergens: [1, 2, 5, 6, 10, 12, 13, 15, 16] }, { name: "배추김치", allergens: [9] }],
      kcal: 916,
    },
    lunch: {
      dishes: [{ name: "미니밥" }, { name: "잔치국수", allergens: [5, 6, 7, 13, 18] }, { name: "데리야끼닭꼬치", allergens: [5, 6, 15] }, { name: "열무김치", allergens: [9] }, { name: "수능화이팅~!", allergens: [4, 5, 6, 14, 19] }, { name: "귤" }],
      kcal: 936,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "감자고추장찌개", allergens: [5, 6] }, { name: "쌀어묵야채볶음", allergens: [1, 5, 6, 13, 18] }, { name: "쫀득킹핫도그", allergens: [1, 2, 5, 6, 10, 12, 16] }, { name: "배추김치", allergens: [9] }],
      kcal: 902,
    },
  },
  "2026-11-18": {
    breakfast: {
      dishes: [{ name: "영양닭죽", allergens: [15] }, { name: "꽈리메추리알장조림", allergens: [1, 13] }, { name: "무장아찌무침", allergens: [13] }, { name: "배추김치", allergens: [9] }, { name: "허쉬초콜릿칩쿠키", allergens: [1, 2, 5, 6] }],
      kcal: 901,
    },
  },
  "2026-11-21": {
    lunch: {
      dishes: [{ name: "찹쌀밥" }, { name: "대파육개장", allergens: [5, 6, 13, 16] }, { name: "왕용가리오븐구이", allergens: [1, 5, 6, 13, 15] }, { name: "깍두기", allergens: [9] }, { name: "에이요", allergens: [13] }],
      kcal: 927,
    },
  },
  "2026-11-23": {
    lunch: {
      dishes: [{ name: "카레라이스", allergens: [1, 2, 5, 6, 12, 13, 15, 16, 18] }, { name: "두부팽이버섯장국", allergens: [5, 6] }, { name: "야채샐러드&키위드레싱", allergens: [1, 2, 5, 6] }, { name: "생선까스", allergens: [1, 5, 6, 13] }, { name: "깍두기", allergens: [9] }],
      kcal: 875,
    },
    dinner: {
      dishes: [{ name: "참치김치밥버거", allergens: [1, 2, 5, 6, 9, 10, 13, 15, 16, 18] }, { name: "우동장국", allergens: [1, 2, 5, 6, 7, 9, 13, 18] }, { name: "무피클" }, { name: "어묵바&소스", allergens: [1, 2, 5, 6, 12] }, { name: "피크닉", allergens: [13] }],
      kcal: 838,
    },
  },
  "2026-11-24": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "감자옹심이국", allergens: [17] }, { name: "청경채나물" }, { name: "닭살데리야끼조림", allergens: [5, 6, 13, 15] }, { name: "배추김치", allergens: [9] }],
      kcal: 864,
    },
    lunch: {
      dishes: [{ name: "찰현미밥" }, { name: "마라탕&옥수수면", allergens: [1, 2, 5, 6, 9, 10, 12, 13, 15, 16, 18] }, { name: "비름나물무침", allergens: [5, 6] }, { name: "꿔바로우파채샐러드", allergens: [1, 2, 5, 6, 10] }, { name: "알타리김치", allergens: [9] }],
      kcal: 928,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼큰수제비국", allergens: [5, 6] }, { name: "숙주미나리무침", allergens: [5, 6] }, { name: "돼지고기두루치기", allergens: [5, 6, 10, 13] }, { name: "배추김치", allergens: [9] }],
      kcal: 895,
    },
  },
  "2026-11-25": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "순두부계란탕", allergens: [1, 5] }, { name: "감자매콤조림", allergens: [5, 6, 13, 18] }, { name: "미니돈까스", allergens: [1, 5, 6, 10, 12, 13, 18] }, { name: "깍두기", allergens: [9] }],
      kcal: 872,
    },
    lunch: {
      dishes: [{ name: "삼색잡채", allergens: [1, 5, 6, 13, 18] }, { name: "찹쌀밥" }, { name: "감자미역국", allergens: [5, 6, 16] }, { name: "매운돼지갈비찜", allergens: [2, 5, 6, 10, 13] }, { name: "깍두기", allergens: [9] }],
      kcal: 961,
    },
    dinner: {
      dishes: [{ name: "쌈장볶음밥", allergens: [1, 5, 6, 9, 10, 13, 18] }, { name: "얼갈이된장국", allergens: [5, 6] }, { name: "실곤약야채무침", allergens: [5, 6, 13] }, { name: "배추김치", allergens: [9] }, { name: "포테이토베이컨피자", allergens: [1, 2, 5, 6, 10, 12, 15, 16] }],
      kcal: 968,
    },
  },
  "2026-11-26": {
    breakfast: {
      dishes: [{ name: "찹쌀밥" }, { name: "초코파이", allergens: [1, 2, 5, 6, 13] }, { name: "들기름북어국", allergens: [1, 5, 6, 13, 16] }, { name: "매콤제육볶음", allergens: [5, 6, 10, 13] }, { name: "오이소박이", allergens: [9] }],
      kcal: 939,
    },
    lunch: {
      dishes: [{ name: "나물비빔밥", allergens: [5, 6, 13, 16] }, { name: "달걀후라이", allergens: [1] }, { name: "미소된장국", allergens: [5, 6] }, { name: "배추김치", allergens: [9] }, { name: "떡꼬치구이", allergens: [5, 6, 12, 13] }, { name: "매콤두부조림", allergens: [1, 2, 5, 6, 14] }],
      kcal: 915,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "맑은콩나물국", allergens: [5] }, { name: "봉추찜닭", allergens: [5, 6, 13, 15, 18] }, { name: "애느타리버섯볶음", allergens: [5, 6, 13, 18] }, { name: "알타리김치", allergens: [9] }],
      kcal: 915,
    },
  },
  "2026-11-27": {
    breakfast: {
      dishes: [{ name: "불고기주먹밥", allergens: [1, 2, 5, 6, 9, 10, 13, 16, 18] }, { name: "뱅글뱅글소시지", allergens: [2, 5, 6, 10, 12, 15, 16] }, { name: "깍두기", allergens: [9] }, { name: "골드키위" }, { name: "시리얼&우유", allergens: [2, 5, 6] }],
      kcal: 913,
    },
    lunch: {
      dishes: [{ name: "찹쌀밥" }, { name: "얼큰어묵국", allergens: [1, 5, 6, 9, 13] }, { name: "바비큐폭찹", allergens: [1, 2, 5, 6, 10, 12, 13, 16] }, { name: "애느타리버섯볶음", allergens: [5, 6, 13, 18] }, { name: "깍두기", allergens: [9] }],
      kcal: 937,
    },
    dinner: { dishes: [], note: "슈퍼 프라이데이" },
  },
  "2026-11-28": {
    breakfast: { dishes: [], note: "슈퍼 프라이데이" },
    lunch: { dishes: [], note: "슈퍼 프라이데이" },
  },
  "2026-11-30": {
    lunch: {
      dishes: [{ name: "찰현미밥" }, { name: "두부김치국", allergens: [5, 9] }, { name: "치커리샐러드&유자드레싱", allergens: [1, 2, 5, 6] }, { name: "경양식돈까스", allergens: [1, 2, 5, 6, 10, 12, 13, 16, 18] }, { name: "깍두기", allergens: [9] }],
      kcal: 924,
    },
    dinner: {
      dishes: [{ name: "찹쌀밥" }, { name: "해물볶음우동", allergens: [5, 6, 8, 9, 12, 13, 17, 18] }, { name: "등뼈감자탕", allergens: [5, 6, 10] }, { name: "청포묵김가루무침", allergens: [5, 6, 16] }, { name: "석박지", allergens: [9] }],
      kcal: 974,
    },
  },
};
