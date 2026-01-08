export default function Footer() {
  const version = process.env.BUILD_VERSION || 'dev';

  return (
    <div className="footer">
      <span>© 出走工程師 Up</span>

      <a
        href="https://upchen.gumroad.com/l/txtconv?utm_source=txtconv&utm_medium=website&utm_content=footer"
        title="捐助支持"
        target="_blank"
        rel="noopener noreferrer"
        className="support-us"
      >
        <span className="icon">
          <i className="fas fa-dollar-sign"></i>
        </span>
        <span>捐款支持</span>
      </a>

      <a href="mailto:hi.upchen@gmail.com" title="hi.upchen@gmail.com">
        <span className="icon">
          <i className="fas fa-envelope"></i>
        </span>
      </a>

      <a
        href="https://www.facebook.com/runawayup/?utm_source=txtconv&utm_medium=website&utm_content=footer"
        title="出走工程師阿普"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="icon">
          <i className="fab fa-facebook-square"></i>
        </span>
      </a>

      <span className="version" title="Build version">{version}</span>
    </div>
  );
}
