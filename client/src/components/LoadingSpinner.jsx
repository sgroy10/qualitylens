export default function LoadingSpinner({ text }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy mx-auto mb-2"></div>
        {text && <p className="text-sm text-gray-500">{text}</p>}
      </div>
    </div>
  );
}
