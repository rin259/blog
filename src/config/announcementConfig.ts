import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告内容
	content: "欢迎来到 rin.red。站点已由 Publii 迁移至 Astro + Keystatic，若有链接失效或显示异常欢迎留言。",

	// 是否允许用户关闭公告
	closable: true,

	link: {
		// 启用链接
		enable: true,
		// 链接文本
		text: "关于本站",
		// 链接 URL
		url: "/about/",
		// 内部链接
		external: false,
	},
};
