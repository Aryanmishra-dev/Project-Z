import { ArrowRight, Upload, Brain, BarChart3, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Header, Footer } from '@/components/common';
import { Button } from '@/components/ui';
import { ROUTES } from '@/utils/constants';

const features = [
  {
    icon: Upload,
    title: 'Upload Any PDF',
    description: 'Simply drag and drop your study materials, textbooks, or lecture notes.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Questions',
    description: 'Our advanced AI generates smart, contextual questions from your content.',
  },
  {
    icon: CheckCircle,
    title: 'Interactive Quizzes',
    description: 'Test your knowledge with immediate feedback and detailed explanations.',
  },
  {
    icon: BarChart3,
    title: 'Track Progress',
    description: 'Monitor your improvement over time with comprehensive analytics.',
  },
];

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-primary-800 py-20 sm:py-32">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Transform PDFs into
              <span className="text-primary-200"> Smart Quizzes</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-primary-100">
              Upload your study materials and let AI generate personalized quizzes to accelerate
              your learning. Perfect for students, professionals, and lifelong learners.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to={ROUTES.REGISTER}>
                <Button size="lg" className="bg-white text-primary-600 hover:bg-primary-50">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to={ROUTES.LOGIN}>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-primary-700"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to study smarter
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Our platform combines cutting-edge AI with proven learning techniques.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                  <feature.icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to boost your learning?
            </h2>
            <p className="mt-4 text-lg text-gray-300">
              Join thousands of learners who are studying smarter, not harder.
            </p>
            <Link to={ROUTES.REGISTER}>
              <Button size="lg" className="mt-8">
                Start Learning Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
