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
        <div className="news-list">
          {news.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <article
                key={item.id}
                className={`news-card${isExpanded ? ' news-card--expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="news-card__header">
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span className="news-card__badge">
                        {t('news.ticker_label')}
                      </span>
                      <time className="news-card__date">
                        {new Date(item.generated_at).toLocaleDateString(
                          i18n.language === 'ko' ? 'ko-KR' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </time>
                    </div>
                    <h3 className="news-card__title">
                      {item.title}
                    </h3>
                    {!isExpanded && (
                      <p className="news-card__summary">
                        {item.summary}
                      </p>
                    )}
                  </div>
                  <span className={`news-card__arrow${isExpanded ? ' news-card__arrow--open' : ''}`}>
                    ▼
                  </span>
                </div>

                {isExpanded && (
                  <div className="news-card__content">
                    {item.content}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
