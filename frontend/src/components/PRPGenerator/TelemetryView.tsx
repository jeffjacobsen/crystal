import React from 'react';
import { TelemetryData } from '../../../../shared/types/telemetry';

interface TelemetryViewProps {
  telemetry?: TelemetryData;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({ telemetry }) => {
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-3">
      {/* Token usage */}
      <div className="space-y-2">
        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">
          Token Usage
        </h5>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs block text-center">Input</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100 text-center h-6 flex items-center justify-center">
              {telemetry ? formatNumber(telemetry.metrics.tokenUsage.input) : '—'}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs block text-center">Output</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100 text-center h-6 flex items-center justify-center">
              {telemetry ? formatNumber(telemetry.metrics.tokenUsage.output) : '—'}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs block text-center">Total</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100 text-center h-6 flex items-center justify-center">
              {telemetry ? formatNumber(telemetry.metrics.tokenUsage.total) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Tool usage */}
      {telemetry && Object.keys(telemetry.metrics.toolDecisions).length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Tool Usage
          </h5>
          <div className="flex flex-wrap gap-2">
            {Object.entries(telemetry.metrics.toolDecisions).map(([tool, count]) => (
              <div
                key={tool}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {tool}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};