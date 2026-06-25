import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content, className = '' }) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a target="_blank" rel="noreferrer" {...props} />,
          table: (props) => <div className="markdown-table-scroll"><table {...props} /></div>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
