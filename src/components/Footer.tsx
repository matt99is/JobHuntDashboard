export default function Footer() {
  return (
    <footer className="border-t border-[#D4D4D4] bg-[#F5F5F5] mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-[#6B6B6B]">
          <div>
            © {new Date().getFullYear()} Job Hunt Assistant. Personal job tracking tool.
          </div>
          <div className="flex gap-6">
            <a
              href="/privacy-policy.html"
              className="hover:text-teal transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
            <a
              href="/terms-of-use.html"
              className="hover:text-teal transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
