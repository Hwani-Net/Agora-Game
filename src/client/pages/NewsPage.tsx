import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchNews } from '../api.js';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  summary: string;
  generated_at: string;
}

export default function NewsPage() {
  const { t, i18n } = useTranslation();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  async function loadNews() {
    setLoading(true);
    try {
      const data = await fetchNews(20);
      setNews(Array.isArray(data) ? (data as NewsItem[]) : []);
    } catch {
      setNews([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-header__title">{t('news.title')}</h2>
          <p className="section-header__subtitle">{t('news.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : news.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📰</div>
          <div className="empty-state__title">{t('news.no_news')}</div>
          <p>{t('news.no_news_hint')}</p>
        </div>
      ) : (
        <div className="news-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {news.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="card"
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary, #f59e0b))',
                        color: 'white',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}>
                        {t('news.ticker_label')}
                      </span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                        {new Date(item.generated_at).toLocaleDateString(
                          i18n.language === 'ko' ? 'ko-KR' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      lineHeight: 1.4,
                    }}>
                      {item.title}
                    </h3>
                    {!isExpanded && (
                      <p style={{ opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
                        {item.summary}
                      </p>
                    )}
                  </div>
                  <span style={{
                    fontSize: '1.2rem',
                    transition: 'transform 0.3s ease',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                    marginTop: '0.25rem',
                  }}>
                    ▼
                  </span>
                </div>

                {isExpanded && (
                  <div style={{
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(128,128,128,0.15)',
                    fontSize: '0.95rem',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-line',
                    animation: 'fadeIn 0.3s ease',
                  }}>
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
