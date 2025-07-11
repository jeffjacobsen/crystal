import { 
  FileText, 
  CheckCircle, 
  Clock, 
  X, 
  Info,
  Zap
} from 'lucide-react';
import type { ProductRequirementPrompt } from '../../types/prp';

interface PRPGuidanceProps {
  prp: ProductRequirementPrompt;
  isVisible: boolean;
  onClose: () => void;
}

export function PRPGuidance({ prp, isVisible, onClose }: PRPGuidanceProps) {
  if (!isVisible) return null;

  const steps = [
    {
      title: "Context Loaded",
      description: "PRP provides Claude with project requirements and context",
      icon: <FileText className="w-5 h-5" />,
      status: "completed"
    },
    {
      title: "Implementation Phase",
      description: "Claude follows the implementation blueprint from the PRP",
      icon: <Zap className="w-5 h-5" />,
      status: "active"
    },
    {
      title: "Validation Loops",
      description: "Run validation commands specified in the PRP",
      icon: <CheckCircle className="w-5 h-5" />,
      status: "pending"
    },
    {
      title: "Success Criteria",
      description: "Verify all success criteria checkboxes are met",
      icon: <Clock className="w-5 h-5" />,
      status: "pending"
    }
  ];

  const getValidationCommands = (prpContent: string) => {
    const bashBlocks = prpContent.match(/```bash\n([\s\S]*?)\n```/g) || [];
    return bashBlocks.map(block => 
      block.replace(/```bash\n/, '').replace(/\n```/, '').trim()
    ).filter(cmd => cmd.length > 0);
  };

  const getSuccessCriteria = (prpContent: string) => {
    const criteria = prpContent.match(/- \[ \] (.+)/g) || [];
    return criteria.map(item => item.replace(/- \[ \] /, ''));
  };

  const validationCommands = getValidationCommands(prp.content);
  const successCriteria = getSuccessCriteria(prp.content);

  return (
    <div className="fixed top-4 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-30">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            PRP Execution Guide
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* PRP Info */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
          {prp.title}
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
          Version {prp.version}
        </p>
      </div>

      {/* Execution Steps */}
      <div className="p-3">
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                step.status === 'completed' 
                  ? 'bg-green-100 border-green-500 text-green-600 dark:bg-green-900/30 dark:border-green-400 dark:text-green-400'
                  : step.status === 'active'
                  ? 'bg-blue-100 border-blue-500 text-blue-600 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-400'
                  : 'bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-700 dark:border-gray-600'
              }`}>
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {step.title}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation Commands */}
      {validationCommands.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Validation Commands
          </h4>
          <div className="space-y-2">
            {validationCommands.slice(0, 3).map((cmd, index) => (
              <div key={index} className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded font-mono">
                {cmd}
              </div>
            ))}
            {validationCommands.length > 3 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                +{validationCommands.length - 3} more commands in PRP
              </p>
            )}
          </div>
        </div>
      )}

      {/* Success Criteria */}
      {successCriteria.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Success Criteria
          </h4>
          <div className="space-y-1">
            {successCriteria.slice(0, 3).map((criteria, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded-sm mt-0.5 flex-shrink-0"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                  {criteria}
                </span>
              </div>
            ))}
            {successCriteria.length > 3 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                +{successCriteria.length - 3} more criteria
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          This PRP guides Claude through structured implementation and validation
        </p>
      </div>
    </div>
  );
}