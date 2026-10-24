const REPO = "https://github.com/zhouPi-314/Visual408-Lab";

/**
 * 页脚：项目说明 + Star / Issue 入口。
 * 只有按钮本身可点，避免整块卡片误触。
 */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="star-card">
        <p className="star-copy">
          这个项目首先服务于考研复习：<strong>宁可少一个实验，也不放一个算错的实验</strong>。
          如果它对你有一点点帮助，欢迎在 GitHub 上点个 Star，或在 Issue 里留下你的建议与纠错。
        </p>
        <div className="star-actions">
          <a
            className="btn btn-primary star-button"
            href={REPO}
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 上给 Visual408 Lab 点 Star"
          >
            <span aria-hidden="true">★</span> 点个 Star
          </a>
          <a
            className="btn star-secondary"
            href={REPO + "/issues/new"}
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 上提交 Issue 或建议"
          >
            提建议 / 纠错
          </a>
        </div>
      </div>
      <p className="star-meta">
        代码以 MIT 许可开源 · 题目与解析均为原创，不收录未授权真题 · 无后端，进度只保存在你的浏览器
      </p>
    </footer>
  );
}
