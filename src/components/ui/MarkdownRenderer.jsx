import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4 text-on-surface" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3 text-on-surface" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2 text-on-surface" {...props} />,
          p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="" {...props} />,
          a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/30 pl-4 italic text-on-surface-variant my-4" {...props} />,
          code: ({node, inline, ...props}) => 
            inline 
              ? <code className="bg-surface-variant/50 px-1.5 py-0.5 rounded text-[0.9em] font-mono text-on-surface-variant" {...props} />
              : <code className="block bg-surface-variant/30 p-4 rounded-xl overflow-x-auto font-mono text-[0.9em] mb-4 border border-outline-variant/30" {...props} />,
          table: ({node, ...props}) => <div className="overflow-x-auto mb-6"><table className="w-full text-left border-collapse" {...props} /></div>,
          th: ({node, ...props}) => <th className="border-b-2 border-outline-variant/50 py-3 px-4 text-on-surface font-bold bg-surface-variant/20 whitespace-nowrap" {...props} />,
          td: ({node, ...props}) => <td className="border-b border-outline-variant/30 py-3 px-4 text-on-surface-variant" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
