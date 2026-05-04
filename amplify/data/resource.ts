import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  ReactionType: a.enum(["FAVORITE", "VIRAL"]),

  // ユーザープロフィール (userId = Cognito Sub)
  User: a
    .model({
      userId: a.string().required(),
      sequentialUserId: a.integer(),
      username: a.string().required(),
      bio: a.string(),
      avatarUrl: a.string(),
      protectedPostCount: a.integer().default(0),
      totalPostCount: a.integer().default(0),
      followingCount: a.integer().default(0),
      followerCount: a.integer().default(0),
      birthdate: a.date(),
      mainUrl: a.string(),
      mainArea: a.string(),
    })
    .identifier(["userId"])
    .secondaryIndexes((index) => [index("sequentialUserId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId"),
      allow.authenticated().to(["read"]),
    ]),

  // sequentialUserId 採番用カウンタ (Lambda が直接 DynamoDB 操作)
  Counter: a
    .model({
      counterName: a.string().required(),
      currentValue: a.integer().required(),
    })
    .identifier(["counterName"])
    .authorization((allow) => [allow.authenticated().to(["read"])]),

  // 投稿
  Post: a
    .model({
      userId: a.string().required(),
      content: a.string().required(),
      originalContent: a.string(),
      isEdited: a.boolean().default(false),
      imageUrls: a.string().array(),
      hashtags: a.string().array(),
      favoriteCount: a.integer().default(0),
      viralCount: a.integer().default(0),
      // Unix timestamp (updatedAt + 7日)。isProtected=true の場合は null
      ttl: a.integer(),
      isProtected: a.boolean().default(false),
    })
    .secondaryIndexes((index) => [index("userId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId"),
      allow.authenticated().to(["read"]),
    ]),

  // フォロー関係 (followerId → followeeId の一方向フォロー)
  Follow: a
    .model({
      followerId: a.string().required(),
      followeeId: a.string().required(),
    })
    .identifier(["followerId", "followeeId"])
    .secondaryIndexes((index) => [index("followeeId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("followerId"),
      allow.authenticated().to(["read"]),
    ]),

  // ユーザーリアクション (Favorite / Viral)
  UserReaction: a
    .model({
      userId: a.string().required(),
      postId: a.string().required(),
      type: a.ref("ReactionType").required(),
    })
    .identifier(["userId", "postId"])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId"),
      allow.authenticated().to(["read"]),
    ]),

  // ハッシュタグ投稿数 (DynamoDB Streams → Lambda が AtomicCounter で更新)
  HashtagCount: a
    .model({
      hashtag: a.string().required(),
      count: a.integer().default(0),
    })
    .identifier(["hashtag"])
    .authorization((allow) => [allow.authenticated().to(["read"])]),

  // ユーザーが作成したリスト
  UserList: a
    .model({
      ownerId: a.string().required(),
      name: a.string().required(),
    })
    .secondaryIndexes((index) => [index("ownerId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("ownerId"),
      allow.authenticated().to(["read"]),
    ]),

  // リストメンバー (追加時に Lambda がフォロー関係を検証)
  UserListMember: a
    .model({
      listId: a.string().required(),
      memberId: a.string().required(),
      // 認可チェック用: リスト作成者の userId
      ownerId: a.string().required(),
      addedAt: a.datetime(),
    })
    .identifier(["listId", "memberId"])
    .authorization((allow) => [
      allow.ownerDefinedIn("ownerId"),
      allow.authenticated().to(["read"]),
    ]),

  // コメント (postId GSI で投稿別一覧、parentCommentId GSI で返信一覧を取得)
  Comment: a
    .model({
      postId: a.string().required(),
      // null = トップレベルコメント、値あり = 返信コメント
      parentCommentId: a.string(),
      userId: a.string().required(),
      content: a.string().required(),
      originalContent: a.string(),
      isEdited: a.boolean().default(false),
      imageUrls: a.string().array(),
      favoriteCount: a.integer().default(0),
      viralCount: a.integer().default(0),
      postedAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index("postId").sortKeys(["postedAt"]),
      index("parentCommentId").sortKeys(["postedAt"]),
    ])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId"),
      allow.authenticated().to(["read"]),
    ]),

  // Favorite ランキング (EventBridge + Lambda バッチが定期上書き)
  FavoriteRanking: a
    .model({
      rankingType: a.string().required(),
      rank: a.integer().required(),
      postId: a.string().required(),
      favoriteCount: a.integer(),
    })
    .identifier(["rankingType", "rank"])
    .authorization((allow) => [allow.authenticated().to(["read"])]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
