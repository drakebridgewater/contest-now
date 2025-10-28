import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface InstructionSection {
  title: string;
  icon?: string;
  instructions: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface InstructionCardProps {
  title: string;
  instructions?: string[];
  sections?: InstructionSection[];
  icon?: string;
  variant?: 'info' | 'success' | 'warning';
  className?: string;
}

const InstructionCard: React.FC<InstructionCardProps> = ({
  title,
  instructions = [],
  sections = [],
  icon = '📋',
  variant = 'info',
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(sections.map((_, index) => sections[index].defaultExpanded !== false ? index : -1).filter(i => i >= 0))
  );

  const getVariantClasses = () => {
    switch (variant) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const renderInstructions = (instructionList: string[], startIndex = 0) => (
    <ul className="space-y-2">
      {instructionList.map((instruction, index) => (
        <li key={index} className="flex items-start gap-2">
          <span className="text-sm font-bold mt-1 min-w-5">{startIndex + index + 1}.</span>
          <span className="text-sm leading-relaxed">{instruction}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`border rounded-lg p-4 ${getVariantClasses()} ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>

      {/* Simple instructions (backward compatibility) */}
      {instructions.length > 0 && renderInstructions(instructions)}

      {/* Sectioned instructions */}
      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((section, sectionIndex) => {
            const isExpanded = expandedSections.has(sectionIndex);

            return (
              <div key={sectionIndex}>
                {section.collapsible ? (
                  <button
                    onClick={() => toggleSection(sectionIndex)}
                    className="flex items-center gap-2 w-full text-left p-2 hover:bg-white hover:bg-opacity-50 rounded-lg transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {section.icon && <span className="text-lg">{section.icon}</span>}
                    <span className="font-semibold">{section.title}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    {section.icon && <span className="text-lg">{section.icon}</span>}
                    <h4 className="font-semibold">{section.title}</h4>
                  </div>
                )}

                {(!section.collapsible || isExpanded) && (
                  <div className={section.collapsible ? 'ml-6' : ''}>
                    {renderInstructions(section.instructions)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructionCard;