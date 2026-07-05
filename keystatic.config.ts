import { config, collection, fields } from "@keystatic/core";

// In production (Cloudflare Pages), use GitHub storage so the admin UI works online.
// In local dev, fall back to local storage (no OAuth needed).
const storage =
	process.env.NODE_ENV === "production"
		? ({
				kind: "github" as const,
				repo: "rin259/blog",
			})
		: ({ kind: "local" as const });

export default config({
	storage,

	collections: {
		posts: collection({
			label: "文章 Posts",
			slugField: "title",
			path: "src/content/posts/*",
			format: { contentField: "content" },
			schema: {
				title: fields.slug({
					name: { label: "標題 Title", validation: { isRequired: true } },
				}),
				published: fields.date({
					label: "發佈日期 Published",
					validation: { isRequired: true },
				}),
				updated: fields.date({
					label: "更新日期 Updated",
					validation: { isRequired: false },
				}),
				draft: fields.checkbox({
					label: "草稿 Draft",
					defaultValue: false,
				}),
				description: fields.text({
					label: "描述 Description",
					multiline: true,
				}),
				image: fields.text({
					label: "封面圖 Cover Image URL",
				}),
				tags: fields.array(
					fields.text({ label: "標籤" }),
					{
						label: "標籤 Tags",
						itemLabel: (p) => p.value,
					},
				),
				category: fields.text({
					label: "分類 Category",
				}),
				lang: fields.text({
					label: "語言 Language (e.g. zh_CN, en)",
				}),
				pinned: fields.checkbox({
					label: "置頂 Pinned",
					defaultValue: false,
				}),
				author: fields.text({
					label: "作者 Author",
				}),
				sourceLink: fields.text({
					label: "原文鏈接 Source Link",
				}),
				licenseName: fields.text({
					label: "許可證名稱 License Name",
				}),
				licenseUrl: fields.text({
					label: "許可證鏈接 License URL",
				}),
				comment: fields.checkbox({
					label: "開啟評論 Enable Comments",
					defaultValue: true,
				}),
				password: fields.text({
					label: "文章密碼 Password",
				}),
				passwordHint: fields.text({
					label: "密碼提示 Password Hint",
				}),
				prevTitle: fields.text({ label: "上一篇標題 (internal)" }),
				prevSlug: fields.text({ label: "上一篇 slug (internal)" }),
				nextTitle: fields.text({ label: "下一篇標題 (internal)" }),
				nextSlug: fields.text({ label: "下一篇 slug (internal)" }),
				content: fields.markdoc({
					label: "正文 Content",
					// Markdoc (not mdx) treats literal <...> and stray text as plain content,
					// so technical posts with <placeholder> angle brackets don't crash the parser.
					// Stored as plain .md to match Firefly's content collection.
					extension: "md",
				}),
			},
		}),
	},
});
