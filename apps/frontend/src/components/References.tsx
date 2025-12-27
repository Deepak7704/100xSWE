"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, BookOpen, Boxes, ExternalLink } from "lucide-react";

const references = [
  {
    icon: FileText,
    title: "Research Papers",
    description:
      "Academic research and papers that inspired the AI-powered code generation approach.",
    items: [
      "SWE-Bench: Evaluating LLMs on Real-World Software Issues",
      "CodeGen: An Open Large Language Model for Code",
      "Self-Refine: Iterative Refinement with Self-Feedback",
    ],
  },
  {
    icon: BookOpen,
    title: "Blogs & Articles",
    description:
      "Technical blogs and articles that guided the implementation of the AI agent.",
    items: [
      "LangChain: Building LLM-powered Applications",
      "GitHub Actions Best Practices",
      "Building Reliable AI Agents",
    ],
  },
  {
    icon: Boxes,
    title: "Architecture",
    description:
      "The system architecture combining LangGraph, vector databases, and sandboxed execution.",
    items: [
      "LangGraph: Multi-Agent Workflows",
      "Pinecone: Vector Search at Scale",
      "E2B: Secure Code Sandboxing",
    ],
  },
];

const References = () => {
  return (
    <section className="py-16 md:py-24 px-4 md:px-8 lg:px-12 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 text-foreground">
            Built on Strong Foundations
          </h2>
          <p className="font-sans text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            The research, resources, and architecture that power this AI coding
            assistant
          </p>
        </div>

        {/* Reference Cards - Black and White Theme with Hover Animation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {references.map((ref, index) => (
            <motion.div
              key={index}
              whileHover={{
                y: -8,
                scale: 1.02,
                transition: { duration: 0.3, ease: "easeOut" },
              }}
              whileTap={{ scale: 0.98 }}
            >
              <Card className="h-full bg-white border border-foreground shadow-lg hover:shadow-2xl transition-shadow duration-300 rounded-2xl overflow-hidden group">
                {/* Header with Icon - Black background */}
                <div className="bg-foreground p-5 md:p-6 group-hover:bg-gray-800 transition-colors duration-300">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <ref.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="font-sans text-lg md:text-xl font-bold text-background">
                    {ref.title}
                  </h3>
                </div>

                {/* Card Content - White background */}
                <CardContent className="p-5 md:p-6 flex flex-col h-auto bg-white">
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">
                    {ref.description}
                  </p>

                  {/* Reference Items */}
                  <div className="space-y-2 mt-auto">
                    {ref.items.map((item, itemIndex) => (
                      <motion.div
                        key={itemIndex}
                        className="flex items-start gap-3 group/item cursor-pointer"
                        whileHover={{ x: 6 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 group-hover/item:text-foreground transition-colors" />
                        <span className="font-sans text-sm text-muted-foreground group-hover/item:text-foreground transition-colors">
                          {item}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default References;
