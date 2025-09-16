"use client";

export default function TestHeroUIPage() {
  return (
    <div className="min-h-screen bg-blue-50 p-8">
      <div className="max-w-md mx-auto">
        <div className="rounded-xl shadow-lg bg-white border border-gray-200">
          <div className="text-center p-6">
            <h1 className="text-2xl font-bold text-blue-600 mb-4">Tailwind Test</h1>
            <p className="text-gray-600 mb-4">If you can see this card with styling, Tailwind is working!</p>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Test Button</button>
          </div>
        </div>
      </div>
    </div>
  );
}
