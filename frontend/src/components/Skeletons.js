import React from 'react';

export const SkeletonBlock = ({ className = '', style = {} }) => {
  return <div className={`skeleton ${className}`.trim()} style={style} />;
};

export const PageHeroSkeleton = () => {
  return (
    <section className="page-hero-skeleton">
      <SkeletonBlock className="page-hero-skeleton__eyebrow" />
      <SkeletonBlock className="page-hero-skeleton__title" />
      <SkeletonBlock className="page-hero-skeleton__text" />
      <SkeletonBlock className="page-hero-skeleton__text page-hero-skeleton__text--short" />
    </section>
  );
};

export const TourCardSkeleton = () => {
  return (
    <article className="tour-card-v2">
      <div className="tour-card-v2__media">
        <SkeletonBlock className="tour-card-skeleton__image" />
      </div>

      <div className="tour-card-v2__content">
        <SkeletonBlock className="tour-card-skeleton__title" />
        <SkeletonBlock className="tour-card-skeleton__location" />
        <SkeletonBlock className="tour-card-skeleton__description" />
        <div className="tour-card-skeleton__chips">
          <SkeletonBlock className="tour-card-skeleton__chip" />
          <SkeletonBlock className="tour-card-skeleton__chip" />
          <SkeletonBlock className="tour-card-skeleton__chip" />
        </div>
      </div>
    </article>
  );
};

export const ToursGridSkeleton = ({ count = 6 }) => {
  return (
    <div className="home-grid">
      {Array.from({ length: count }).map((_, index) => (
        <TourCardSkeleton key={index} />
      ))}
    </div>
  );
};

export const StatSkeleton = () => {
  return (
    <div className="compact-stat">
      <SkeletonBlock style={{ width: '72px', height: '12px' }} />
      <SkeletonBlock style={{ width: '54px', height: '24px', marginTop: '8px' }} />
    </div>
  );
};

export const NotificationCardSkeleton = () => {
  return (
    <article className="notification-card">
      <SkeletonBlock className="notification-card-skeleton__icon" />

      <div className="notification-card__content">
        <div className="notification-card__top">
          <div className="notification-card__head" style={{ width: '100%' }}>
            <div className="notification-card__chips">
              <SkeletonBlock style={{ width: '74px', height: '28px', borderRadius: '999px' }} />
              <SkeletonBlock style={{ width: '96px', height: '28px', borderRadius: '999px' }} />
            </div>

            <SkeletonBlock style={{ width: '58%', height: '24px', marginTop: '10px' }} />
          </div>

          <SkeletonBlock style={{ width: '110px', height: '14px' }} />
        </div>

        <SkeletonBlock style={{ width: '100%', height: '16px', marginTop: '14px' }} />
        <SkeletonBlock style={{ width: '84%', height: '16px', marginTop: '10px' }} />

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <SkeletonBlock style={{ width: '180px', height: '40px', borderRadius: '14px' }} />
          <SkeletonBlock style={{ width: '96px', height: '40px', borderRadius: '14px' }} />
        </div>
      </div>
    </article>
  );
};

export const NotificationListSkeleton = ({ count = 4 }) => {
  return (
    <section className="notifications-list">
      {Array.from({ length: count }).map((_, index) => (
        <NotificationCardSkeleton key={index} />
      ))}
    </section>
  );
};

export const BookingCardSkeleton = () => {
  return (
    <article className="booking-card">
      <div className="booking-card__top">
        <div style={{ width: '100%' }}>
          <SkeletonBlock style={{ width: '120px', height: '28px', borderRadius: '999px' }} />
          <SkeletonBlock style={{ width: '52%', height: '28px', marginTop: '14px' }} />
          <SkeletonBlock style={{ width: '34%', height: '14px', marginTop: '10px' }} />
        </div>

        <div style={{ minWidth: '120px' }}>
          <SkeletonBlock style={{ width: '56px', height: '12px', marginLeft: 'auto' }} />
          <SkeletonBlock style={{ width: '116px', height: '28px', marginTop: '8px', marginLeft: 'auto' }} />
        </div>
      </div>

      <div className="booking-card__chips">
        <SkeletonBlock style={{ width: '96px', height: '28px', borderRadius: '999px' }} />
        <SkeletonBlock style={{ width: '130px', height: '28px', borderRadius: '999px' }} />
        <SkeletonBlock style={{ width: '70px', height: '28px', borderRadius: '999px' }} />
      </div>

      <div className="booking-card__grid">
        <SkeletonBlock style={{ height: '72px', borderRadius: '18px' }} />
        <SkeletonBlock style={{ height: '72px', borderRadius: '18px' }} />
        <SkeletonBlock style={{ height: '72px', borderRadius: '18px' }} />
        <SkeletonBlock style={{ height: '72px', borderRadius: '18px' }} />
      </div>
    </article>
  );
};

export const BookingListSkeleton = ({ count = 3 }) => {
  return (
    <section className="bookings-list">
      {Array.from({ length: count }).map((_, index) => (
        <BookingCardSkeleton key={index} />
      ))}
    </section>
  );
};