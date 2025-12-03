'use client';

import { FileText, Globe, Globe2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ArticleViewerProps {
  articleEnglish: string | null;
  articleFrench: string | null;
  publishedEnglish: boolean;
  publishedFrench: boolean;
  publishedEnglishAt: string | null;
  publishedFrenchAt: string | null;
}

function renderArticle(content: string | null) {
  if (!content) return null;

  try {
    // Try to parse as JSON first
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      const parsed = JSON.parse(content);
      return (
        <>
          <h2 className="text-xl font-bold mb-4">{parsed.title || 'Article'}</h2>
          <div dangerouslySetInnerHTML={{ __html: parsed.article || parsed.content || '' }} />
        </>
      );
    }
    // Otherwise render as markdown
    return <ReactMarkdown>{content}</ReactMarkdown>;
  } catch {
    // If parsing fails, render as markdown
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }
}

export default function ArticleViewer({
  articleEnglish,
  articleFrench,
  publishedEnglish,
  publishedFrench,
  publishedEnglishAt,
  publishedFrenchAt,
}: ArticleViewerProps) {
  return (
    <div className="space-y-6">
      {/* English Article */}
      {articleEnglish && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">English Article</h3>
            </div>
            {publishedEnglish && (
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">
                Published {publishedEnglishAt ? new Date(publishedEnglishAt).toLocaleDateString() : ''}
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none">
            {renderArticle(articleEnglish)}
          </div>
        </div>
      )}

      {/* French Article */}
      {articleFrench && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">French Article</h3>
            </div>
            {publishedFrench && (
              <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full">
                Published {publishedFrenchAt ? new Date(publishedFrenchAt).toLocaleDateString() : ''}
              </span>
            )}
          </div>
          <div className="prose prose-sm max-w-none">
            {renderArticle(articleFrench)}
          </div>
        </div>
      )}

      {!articleEnglish && !articleFrench && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No articles generated yet</p>
        </div>
      )}
    </div>
  );
}
