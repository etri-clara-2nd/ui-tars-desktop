import { ContentProps } from '../types';
import { DefaultTip } from '../../DefaultTip';

export function ScreenshotContent({ params, result }: ContentProps) {
  if (!result) {
    return <DefaultTip description="Taking screenshot..." />;
  }

  // result가 배열인 경우 visionAnalysis 찾기
  const visionAnalysis = Array.isArray(result)
    ? result.find((item) => item.type === 'vision_analysis')?.content
    : null;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <img
        src={
          Array.isArray(result)
            ? result.find((item) => item.type === 'image')?.path
            : result
        }
        alt="Screenshot"
        className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
      />
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Screenshot: {params.name}
        {params.selector && <span className="ml-2">({params.selector})</span>}
      </div>
      {visionAnalysis && (
        <div className="w-full mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Vision Analysis</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {visionAnalysis}
          </p>
        </div>
      )}
    </div>
  );
}
