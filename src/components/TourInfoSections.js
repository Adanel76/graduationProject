import React, { useMemo, useState } from 'react';

const sectionIcons = {
  accommodation: '🛏️',
  meals: '🍽️',
  activities: '🎯',
  resort: '🗺️',
};

const TourInfoSections = ({ tour }) => {
  const [activeSection, setActiveSection] = useState(null);

  const sections = useMemo(() => {
    return [
      {
        key: 'accommodation',
        title: 'Проживание',
        shortText:
          tour?.accommodation ||
          `Комфортное размещение на маршруте ${tour?.city || ''}, ${tour?.country || ''}. Тип проживания уточняется менеджером при подтверждении заявки.`,
      },
      {
        key: 'meals',
        title: 'Питание',
        shortText:
          tour?.meals ||
          'Базовое питание по программе тура. Детали зависят от отеля и формата поездки.',
      },
      {
        key: 'activities',
        title: 'Активности',
        shortText:
          tour?.activities ||
          'Экскурсионные и свободные активности по программе. Точный график доступен после подтверждения бронирования.',
      },
      {
        key: 'resort',
        title: 'О курорте',
        shortText:
          tour?.resort_info ||
          `Актуальная информация о направлении ${tour?.city || ''}, ${tour?.country || ''}: сезонность, особенности отдыха и рекомендации перед поездкой.`,
      },
    ];
  }, [tour]);

  return (
    <>
      <section className="tour-info-section motion-fade">
        <div className="tour-info-section__head">
          <div>
            <span className="home-hero__eyebrow">Tour includes</span>
            <h2>Что входит в тур</h2>
          </div>

          <p>
            Нажмите на карточку, чтобы открыть подробности по проживанию,
            питанию, активностям и направлению.
          </p>
        </div>

        <div className="tour-info-grid">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              className="tour-info-card"
              onClick={() => setActiveSection(section)}
            >
              <span className="tour-info-card__icon">
                {sectionIcons[section.key]}
              </span>

              <strong>{section.title}</strong>
              <p>{section.shortText}</p>

              <span className="tour-info-card__more">Подробнее →</span>
            </button>
          ))}
        </div>
      </section>

      {activeSection && (
        <div
          className="tour-info-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveSection(null);
            }
          }}
        >
          <div className="tour-info-modal__panel">
            <button
              type="button"
              className="tour-info-modal__close"
              onClick={() => setActiveSection(null)}
              aria-label="Закрыть"
            >
              ×
            </button>

            <span className="home-hero__eyebrow">Подробнее о туре</span>
            <h2>{activeSection.title}</h2>

            <p>{activeSection.shortText}</p>

            <div className="tour-info-modal__note">
              <strong>Важно:</strong>
              <span>
                Финальные детали тура подтверждаются менеджером после оформления заявки.
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TourInfoSections;