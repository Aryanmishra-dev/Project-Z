import { Link } from 'react-router-dom';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          {/* Brand */}
          <div className="flex items-center justify-center md:justify-start">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <span className="text-lg font-bold text-white">Q</span>
            </div>
            <span className="ml-2 text-lg font-semibold text-gray-900">
              QuizGenius
            </span>
          </div>

          {/* Links */}
          <nav className="mt-4 flex justify-center gap-6 md:mt-0" aria-label="Footer navigation">
            <Link
              to="/privacy"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Terms of Service
            </Link>
            <Link
              to="/contact"
              className="text-sm text-gray-500 hover:text-gray-900"
            >
              Contact
            </Link>
          </nav>

          {/* Social */}
          <div className="mt-4 flex justify-center gap-4 md:mt-0">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 border-t border-gray-100 pt-6 text-center">
          <p className="text-sm text-gray-500">
            © {currentYear} QuizGenius. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
