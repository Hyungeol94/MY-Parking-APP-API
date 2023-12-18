import { nextSeq } from "../../utils/dbUtil.js";
import moment from "moment";

function getDay(day = 0) {
  return moment().add(day, "days").format("YYYY.MM.DD");
}
function getTime(day = 0, second = 0) {
  return moment()
    .add(day, "days")
    .add(second, "seconds")
    .format("YYYY.MM.DD HH:mm:ss");
}

export const initData = {
  // 회원
  user: [
    {
      _id: await nextSeq("user"),
      email: "seller1@seller1.com",
      password: "$2b$10$S.8GNMDyvUF0xzujPtHBu.j5gtS19.OhRmYbpJBnCHg2S83WLx1T2",
      name: "수암매니저",
      phone: "01011112222",
      address: "수원시 권선구 세류동",
      type: "seller",
      createdAt: getTime(-100, -60 * 60 * 3),
      updatedAt: getTime(-100, -60 * 60 * 3),
      extra: {
        carNumber: "40나 4405",
        profileImage: "",
        lat: 0,
        lng: 0,
      },
    },
    {
      _id: await nextSeq("user"),
      email: "seller2@seller2.com",
      password: "$2b$10$S.8GNMDyvUF0xzujPtHBu.j5gtS19.OhRmYbpJBnCHg2S83WLx1T2",
      name: "현걸매니저",
      phone: "01033334444",
      address: "서울시 영등포구 영등포동",
      type: "seller",
      createdAt: getTime(-100, -60 * 60 * 3),
      updatedAt: getTime(-100, -60 * 60 * 3),
      extra: {
        carNumber: "22호 4499",
        profileImage: "",
        lat: 0,
        lng: 0,
      },
    },
    {
      _id: await nextSeq("user"),
      email: "user1@user1.com",
      password: "$2b$10$S.8GNMDyvUF0xzujPtHBu.j5gtS19.OhRmYbpJBnCHg2S83WLx1T2",
      name: "현걸매니저",
      phone: "01033334444",
      address: "서울시 영등포구 영등포동",
      type: "seller",
      createdAt: getTime(-100, -60 * 60 * 3),
      updatedAt: getTime(-100, -60 * 60 * 3),
      extra: {
        carNumber: "22호 4499",
        profileImage: "",
        lat: 0,
        lng: 0,
      },
    },
  ],
  // 상품
  product: [
    {
      _id: await nextSeq("product"),
      seller_id: 1,
      price: 20000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "서울선릉과정릉 공영주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking1.jpg`,
          fileName: "sample-parking1.jpg",
          orgName: "주차장1.jpg",
        },
      ],
      content: `저희 주차장은 간격이 괜찮아요. 자세한 내용은 연락주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-14",
        endDate: "2023-12-14",
        address: "서울 강남구 선릉로100길 1 선릉정릉",
        lat: 37.5073677154051,
        lng: 127.047165945717,
        sellerNickname: "주차왕",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 1,
      price: 10000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "포스코센터 주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking2.jpg`,
          fileName: "sample-parking2.jpg",
          orgName: "주차장2.jpg",
        },
      ],
      content: `저희 주차장은 간격이 괜찮아요. 자세한 내용은 연락주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-23",
        endDate: "2023-12-23",
        address: "서울 강남구 테헤란로 440",
        lat: 37.5058149679709,
        lng: 127.056130956028,
        sellerNickname: "주차왕",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 2,
      price: 50000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "삼성제일주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking6.jpg`,
          fileName: "sample-parking6.jpg",
          orgName: "주차장6.jpg",
        },
      ],
      content: `주차장이 협소하지만 위치가 좋아요. 자세한 내용은 연락주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-30",
        endDate: "2023-12-30",
        address: "서울 강남구 테헤란로77길 11-4",
        lat: 37.50723060611971,
        lng: 127.05405074030013,
        sellerNickname: "주차여왕",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 3,
      price: 23000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "강남구공영노상주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking4.jpg`,
          fileName: "sample-parking4.jpg",
          orgName: "주차장4.jpg",
        },
      ],
      content: `주차장이 협소하지만 위치가 좋아요. 자세한 내용은 연락주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-30",
        endDate: "2023-12-30",
        address: "서울 강남구 테헤란로 421-2",
        lat: 37.5058128849922,
        lng: 127.052631238321,
        sellerNickname: "주차여왕",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 3,
      price: 5000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "대치타워 주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking7.jpg`,
          fileName: "sample-parking7.jpg",
          orgName: "주차장7.jpg",
        },
      ],
      content: `주차장이 협소하지만 위치가 좋아요. 편하게 문의 주시면 됩니다. 자세한 내용은 연락주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-30",
        endDate: "2023-12-30",
        address: "서울 강남구 테헤란로 424",
        lat: 37.5056414183255,
        lng: 127.05364470328,
        sellerNickname: "주차여왕",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 4,
      price: 10000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "한신인터밸리24 주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking8.jpg`,
          fileName: "sample-parking8.jpg",
          orgName: "주차장8.jpg",
        },
      ],
      content: `자세한 내용은 연락주세요. 01033044004`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-20",
        endDate: "2023-12-20",
        address: "서울 강남구 테헤란로 322 한신인터밸리24빌딩",
        lat: 37.5033153168264,
        lng: 127.04657914958356,
        sellerNickname: "아이돈노",
      },
    },
    {
      _id: await nextSeq("product"),
      seller_id: 5,
      price: 12000,
      shippingFees: 0,
      show: true,
      active: true,
      name: "역삼아르누보씨티주차장",
      quantity: 1, // 전체상품수지만 우린 하나뿐
      buyQuantity: 0, // 구매완료된것 : 0
      mainImages: [
        {
          url: `/files/sample-parking9.jpg`,
          fileName: "sample-parking9.jpg",
          orgName: "주차장9.jpg",
        },
      ],
      content: `역삼역과 가까운 위치에 있습니다. 사실 한달정도 사용하지 않는 기간이 길어질거 같아서 추가 연장도 가능합니다. 문의 주세요`,
      createdAt: getTime(-41, -60 * 60 * 2),
      updatedAt: getTime(-40, -60 * 15),
      extra: {
        isNew: true,
        isBest: true,
        category: ["PC03", "PC0301"],
        sort: 5,
        startDate: "2023-12-20",
        endDate: "2023-12-20",
        address: "서울 강남구 언주로 506 역삼 아르누보씨티",
        lat: 37.50341765068449,
        lng: 127.04282333594166,
        sellerNickname: "프로 주차디깅러",
      },
    },
  ],
  // 주문
  order: [
    {
      _id: await nextSeq("order"),
      user_id: 4,
      state: "OS020",
      products: [
        {
          _id: 2,
          seller_id: 1,
          state: "OS020",
          name: "서울선릉과정릉 공영주차장",
          image: `/files/sample-parking1.jpg`,
          quantity: 1,
          price: 20000,
          reply_id: 3,
        },
      ],
      cost: {
        products: 20000,
        shippingFees: 0,
        discount: {
          products: 0,
          shippingFees: 0,
        },
        total: 20000,
      },
      address: {
        name: "회사",
        value: "서울시 강남구 신사동 234",
      },
      createdAt: getTime(-6, -60 * 60 * 3),
      updatedAt: getTime(-6, -60 * 60 * 3),
    },
    {
      _id: await nextSeq("order"),
      user_id: 4,
      state: "OS030",
      products: [
        {
          _id: 3,
          seller_id: 1,
          state: "OS030",
          name: "포스코센터 주차장",
          image: `/files/sample-parking2.jpg`,
          quantity: 1,
          price: 10000,
        },
        {
          _id: 4,
          seller_id: 3,
          state: "OS050",
          name: "삼성제일주차장",
          image: `/files/sample-parking6.png`,
          quantity: 1,
          price: 50000,
          reply_id: 2,
        },
      ],
      cost: {
        products: 60000,
        shippingFees: 0,
        discount: {
          products: 0,
          shippingFees: 0,
        },
        total: 60000,
      },
      address: {
        name: "집",
        value: "서울시 강남구 역삼동 123",
      },
      createdAt: getTime(-4, -60 * 60 * 22),
      updatedAt: getTime(-2, -60 * 60 * 12),
    },
    {
      _id: await nextSeq("order"),
      user_id: 4,
      state: "OS040",
      products: [
        {
          _id: 4,
          seller_id: 3,
          state: "OS110",
          name: "강남구공영노상주차장",
          image: `/files/sample-parking4.png`,
          quantity: 1,
          price: 23000,
          reply_id: 1,
        },
        {
          _id: 4,
          seller_id: 3,
          state: "OS110",
          name: "대치타워 주차장",
          image: `/files/sample-parking7.png`,
          quantity: 1,
          price: 5000,
          reply_id: 1,
        },
        {
          _id: 4,
          seller_id: 4,
          state: "OS110",
          name: "한신인터밸리24 주차장",
          image: `/files/sample-parking8.png`,
          quantity: 1,
          price: 10000,
          reply_id: 1,
        },
      ],
      cost: {
        products: 38000,
        shippingFees: 0,
        discount: {
          products: 0,
          shippingFees: 0,
        },
        total: 38000,
      },
      address: {
        name: "학교",
        value: "서울시 강남구 역삼동 234",
      },
      createdAt: getTime(-3, -60 * 60 * 18),
      updatedAt: getTime(-1, -60 * 60 * 1),
    },
  ],
  // 후기
  reply: [
    {
      _id: await nextSeq("reply"),
      user_id: 4,
      order_id: 1,
      product_id: 2,
      rating: 4,
      content: "주차 자리가 협소하지만, 위치가 좋아요.",
      createdAt: getTime(-4, -60 * 60 * 12),
    },
    {
      _id: await nextSeq("reply"),
      user_id: 2,
      order_id: 2,
      product_id: 2,
      rating: 3,
      content: "가격이 비싸요...",
      createdAt: getTime(-3, -60 * 60 * 1),
    },
    {
      _id: await nextSeq("reply"),
      user_id: 4,
      order_id: 2,
      product_id: 3,
      rating: 1,
      content: "매우 저렴하게 잘 이용했습니다. 나중에도 이용 해봐야겠어요!!",
      extra: {
        title: "추천하지 않습니다.",
      },
      createdAt: getTime(-2, -60 * 60 * 10),
    },
  ],
  // 장바구니
  cart: [
    {
      _id: await nextSeq("cart"),
      user_id: 4,
      product_id: 1,
      quantity: 1,
      createdAt: getTime(-7, -60 * 30),
      updatedAt: getTime(-7, -60 * 30),
    },
    {
      _id: await nextSeq("cart"),
      user_id: 4,
      product_id: 2,
      quantity: 1,
      createdAt: getTime(-4, -60 * 30),
      updatedAt: getTime(-3, -60 * 60 * 12),
    },
    {
      _id: await nextSeq("cart"),
      user_id: 2,
      product_id: 3,
      quantity: 1,
      createdAt: getTime(-3, -60 * 60 * 4),
      updatedAt: getTime(-3, -60 * 60 * 4),
    },
    {
      _id: await nextSeq("cart"),
      user_id: 2,
      product_id: 4,
      quantity: 1,
      createdAt: getTime(-2, -60 * 60 * 12),
      updatedAt: getTime(-1, -60 * 60 * 20),
    },
  ],
  // 즐겨찾기/북마크
  bookmark: [
    {
      _id: await nextSeq("bookmark"),
      user_id: 4,
      product_id: 2,
      memo: "첫째 크리스마스 선물.",
      createdAt: getTime(-3, -60 * 60 * 2),
    },
    {
      _id: await nextSeq("bookmark"),
      user_id: 4,
      product_id: 3,
      memo: "둘째 입학 선물",
      createdAt: getTime(-2, -60 * 60 * 20),
    },
    {
      _id: await nextSeq("bookmark"),
      user_id: 4,
      product_id: 4,
      memo: "이달 보너스타면 꼭!!!",
      createdAt: getTime(-1, -60 * 60 * 12),
    },
    {
      _id: await nextSeq("bookmark"),
      user_id: 2,
      product_id: 4,
      memo: "1순위로 살것!",
      createdAt: getTime(-1, -60 * 60 * 12),
    },
  ],
  // QnA, 공지사항, 게시판
  post: [],
  // 코드
  code: [],
  // 설정
  config: [],
};
