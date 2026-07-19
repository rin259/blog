import { defineConfig } from "tinacms";

export default defineConfig({
	branch: process.env.GITHUB_BRANCH || "main",
	clientId: process.env.TINA_CLIENT_ID!,
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
