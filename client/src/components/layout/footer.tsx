export function Footer() {
  return (
    <footer className="bg-white py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-neutral-500">
          <p>© {new Date().getFullYear()} ChatterBox. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
