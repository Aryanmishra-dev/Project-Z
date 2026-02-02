import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <span className="text-xl font-bold text-primary-600">Q</span>
            </div>
            <span className="text-2xl font-bold text-white">QuizGenius</span>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Transform your PDFs into
            <br />
            interactive quizzes
          </h1>
          <p className="text-lg text-primary-100">
            Upload any PDF document and let our AI generate smart questions to help you learn faster
            and retain more.
          </p>

          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full border-2 border-primary-600 bg-primary-400"
                />
              ))}
            </div>
            <p className="text-primary-100">
              Join <span className="font-semibold text-white">10,000+</span> learners
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8 text-primary-200 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            AI-Powered
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Instant Results
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Track Progress
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex flex-1 items-center justify-center p-6 bg-gray-50">
        <Outlet />
      </div>
    </div>
  );
}
