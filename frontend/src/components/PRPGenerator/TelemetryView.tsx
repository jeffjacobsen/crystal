import React from 'react';
import { TelemetryData } from '../../../../shared/types/telemetry';

interface TelemetryViewProps {
  telemetry?: TelemetryData;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({ telemetry }) => {
  if (!telemetry) return null;

  const formatNumber = (num: number) => num.toLocaleString();
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const activeSpansCount = telemetry.traces.spans.filter(span => !span.endTime).length;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
        Claude Activity Monitor
        {activeSpansCount > 0 && (
          <span className="ml-2 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
            <span className="text-xs text-green-600 dark:text-green-400">Active</span>
          </span>
        )}
      </h4>

      {/* Token usage */}
      <div className="space-y-2">
        <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          Token Usage
        </h5>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Input</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100">
              {formatNumber(telemetry.metrics.tokenUsage.input)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Output</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100">
              {formatNumber(telemetry.metrics.tokenUsage.output)}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-gray-500 dark:text-gray-400 text-xs">Total</span>
            <div className="font-mono font-medium text-gray-900 dark:text-gray-100">
              {formatNumber(telemetry.metrics.tokenUsage.total)}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">API Cost</span>
          <div className="font-mono text-gray-900 dark:text-gray-100">
            ${telemetry.metrics.apiCost.toFixed(4)}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">Active Time</span>
          <div className="font-mono text-gray-900 dark:text-gray-100">
            {formatDuration(telemetry.metrics.activeTimeMs)}
          </div>
        </div>
      </div>

      {/* Tool usage */}
      {Object.keys(telemetry.metrics.toolDecisions).length > 0 && (
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

      {/* Active operations timeline */}
      {telemetry.traces.spans.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Operations
          </h5>
          <div className="space-y-1.5">
            {telemetry.traces.spans.slice(-5).map((span, idx) => {
              const isActive = !span.endTime;
              const startTime = new Date(span.startTime);
              const duration = span.duration || (Date.now() - startTime.getTime());
              
              return (
                <div key={`${span.name}-${idx}`} className="flex items-center space-x-2 text-xs">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`}
                    data-testid={isActive ? 'active-indicator' : undefined}
                  />
                  <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                    {span.name.replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">
                    {isActive ? `${formatDuration(duration)}...` : formatDuration(duration)}
                  </span>
                </div>
              );
            })}
            {telemetry.traces.spans.length > 5 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                ... and {telemetry.traces.spans.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last update */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
        Last update: {new Date(telemetry.lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
};