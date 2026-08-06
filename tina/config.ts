import { defineConfig } from "tinacms";

export default defineConfig({
	branch: process.env.GITHUB_BRANCH || "main",
	clientId: "7b033483-fb7e-43c0-a80e-8bfc73834d15",
	token: process.env.TINA_TOKEN!,

	build: {
		outputFolder: "admin",
		publicFolder: "public",
	},
	media: {
		tina: {
			mediaRoot: "assets/images",
			publicFolder: "public",
		},
	},

	schema: {
		collections: [
			{
				name: "post",
				label: "文章 Posts",
				path: "src/content/posts",
				format: "md",
				fields: [
					{
						type: "string",
						name: "title",
						label: "標題 Title",
						isTitle: true,
						required: true,
					},
					{
						type: "datetime",
						name: "published",
						label: "發佈日期 Published",
						required: true,
					},
					{
						type: "datetime",
						name: "updated",
						label: "更新日期 Updated",
					},
					{
						type: "boolean",
						name: "draft",
						label: "草稿 Draft",
					},
					{
						type: "string",
						name: "description",
						label: "描述 Description",
						ui: { component: "textarea" },
					},
					{
						type: "image",
						name: "image",
						label: "封面圖 Cover Image",
					},
					{
						type: "string",
						name: "tags",
						label: "標籤 Tags",
						list: true,
					},
					{
						type: "string",
						name: "category",
						label: "分類 Category",
					},
					{
						type: "string",
						name: "lang",
						label: "語言 Language",
					},
					{
						type: "boolean",
						name: "pinned",
						label: "置頂 Pinned",
					},
					{
						type: "string",
						name: "author",
						label: "作者 Author",
					},
					{
						type: "boolean",
						name: "comment",
						label: "開啟評論 Comments",
					},
					{
						type: "string",
						name: "sourceLink",
						label: "原文鏈接 Source Link",
					},
					{
						type: "string",
						name: "licenseName",
						label: "許可協議名 License Name",
					},
					{
						type: "string",
						name: "licenseUrl",
						label: "許可協議 URL License URL",
					},
					{
						type: "string",
						name: "password",
						label: "訪問密碼 Password",
					},
					{
						type: "string",
						name: "passwordHint",
						label: "密碼提示 Password Hint",
					},
					{
						type: "rich-text",
						name: "body",
						label: "正文 Content",
						isBody: true,
					},
				],
			},
			// 純 Markdown 專頁；friends.mdx 含 JSX/資料宣告，暫不交由 Tina 改寫。
			{
				name: "about",
				label: "關於我 About",
				path: "src/content/spec",
				match: { include: "about.md" },
				format: "md",
				fields: [
					{
						type: "string",
						name: "title",
						label: "標題 Title",
						required: true,
					},
					{
						type: "string",
						name: "description",
						label: "描述 Description",
						ui: { component: "textarea" },
					},
					{
						type: "rich-text",
						name: "body",
						label: "正文 Content",
						isBody: true,
					},
				],
			},
			{
				name: "guestbook",
				label: "留言板 Guestbook",
				path: "src/content/spec",
				match: { include: "guestbook.md" },
				format: "md",
				fields: [
					{
						type: "string",
						name: "title",
						label: "標題 Title",
						required: true,
					},
					{
						type: "string",
						name: "description",
						label: "描述 Description",
						ui: { component: "textarea" },
					},
					{
						type: "rich-text",
						name: "body",
						label: "正文 Content",
						isBody: true,
					},
				],
			},
		],
	},
});
