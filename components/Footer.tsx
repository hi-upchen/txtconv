export default function Footer() {
  const version = process.env.BUILD_VERSION || 'dev';

  return (
    <footer className="mt-auto py-12 px-6 border-t border-gray-200 bg-white">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between text-gray-400 text-xs gap-6">
        <div className="flex items-center gap-6">
          {/* Name */}
          <span className="hover:text-gray-600 transition-colors cursor-pointer">
            © 出走工程師 Up
          </span>

          {/* Donate */}
          <a
            href="https://upchen.gumroad.com/l/txtconv?utm_source=txtconv&utm_medium=website&utm_content=footer"
            title="捐助支持"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-gray-600 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">attach_money</span>
            捐款支持
          </a>

          {/* Icons */}
          <div className="flex items-center gap-3">
            {/* Email */}
            <a
              href="mailto:hi.upchen@gmail.com"
              title="hi.upchen@gmail.com"
              className="hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">mail</span>
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/runawayup/?utm_source=txtconv&utm_medium=website&utm_content=footer"
              title="出走工程師阿普"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Version */}
        <div className="text-gray-300 font-mono text-[11px]">{version}</div>
      </div>
    </footer>
  );
}
