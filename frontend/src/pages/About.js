import React from 'react';

const About = () => {
  const clientCards = [
    {
      number: '01',
      title: 'Путешественникам',
      text:
        'Помогаем выбрать направление, сравнить варианты размещения, уточнить даты, стоимость и оформить поездку без лишних сложностей.',
    },
    {
      number: '02',
      title: 'Семьям и парам',
      text:
        'Подбираем комфортные маршруты с учётом бюджета, состава туристов, длительности отдыха, питания и желаемого уровня сервиса.',
    },
    {
      number: '03',
      title: 'Корпоративным клиентам',
      text:
        'Организуем групповые поездки, деловые мероприятия, трансферы и размещение для команд, партнёров и сотрудников компании.',
    },
    {
      number: '04',
      title: 'Партнёрам',
      text:
        'Работаем с отелями, гидами, организаторами мероприятий и поставщиками услуг, чтобы формировать качественные туристические предложения.',
    },
  ];

  const services = [
    'Подбор туров по России и миру',
    'Бронирование отелей и размещения',
    'Экскурсии и программы отдыха',
    'Трансферы и сопровождение',
    'Индивидуальные маршруты',
    'Семейные и групповые поездки',
    'Акции, новости и спецпредложения',
    'Поддержка на этапах оформления',
  ];

  const processItems = [
    {
      title: 'Уточняем запрос',
      text: 'Понимаем направление, даты, бюджет, состав туристов и ожидания от поездки.',
    },
    {
      title: 'Подбираем варианты',
      text: 'Предлагаем подходящие туры, отели, активности и условия размещения.',
    },
    {
      title: 'Оформляем поездку',
      text: 'Фиксируем заявку, согласовываем детали и передаём клиенту понятную информацию по туру.',
    },
    {
      title: 'Сопровождаем клиента',
      text: 'Помогаем отслеживать статус бронирования, уведомления и важные изменения перед поездкой.',
    },
  ];

  return (
    <main className="about-page">
      <div className="page-shell">
        <section className="about-hero motion-rise about-hero--company">
          <div className="about-hero__content">
            <span className="home-hero__eyebrow">О компании</span>

            <h1>Travel Agency</h1>

            <p>
              Travel Agency — туристическая компания, которая помогает клиентам
              находить подходящие туры, планировать поездки, выбирать отели,
              знакомиться с программой отдыха и оформлять бронирование через
              удобную онлайн-платформу.
            </p>

            <div className="about-hero__actions">
              <a href="/tours" className="site-button site-button--primary">
                Смотреть туры
              </a>

              <a href="/events" className="site-button site-button--secondary">
                Новости и акции
              </a>
            </div>
          </div>

          <div className="about-hero__panel">
            <div>
              <span>Формат работы</span>
              <strong>Онлайн-подбор и оформление туров</strong>
            </div>

            <div>
              <span>Направления</span>
              <strong>Россия и зарубежные поездки</strong>
            </div>

            <div>
              <span>Главный принцип</span>
              <strong>Понятный сервис и забота о клиенте</strong>
            </div>
          </div>
        </section>

        <section className="about-section motion-fade">
          <div className="about-section__head">
            <span className="home-hero__eyebrow">Услуги</span>
            <h2>Чем занимается компания</h2>
            <p>
              Мы объединяем подбор туров, оформление заявок, информацию об отелях,
              программах питания, активностях и курортах в одном удобном сервисе
              для будущих путешественников.
            </p>
          </div>

          <div className="about-features-grid">
            {services.map((service) => (
              <div className="about-feature-card" key={service}>
                <span>✦</span>
                <strong>{service}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section about-section--dark motion-fade">
          <div className="about-section__head">
            <span className="about-dark-eyebrow">Для кого</span>
            <h2>Кому помогает Travel Agency</h2>
            <p>
              Платформа ориентирована на клиентов, которым важно быстро понять
              условия поездки, сравнить предложения и получить сопровождение со
              стороны туристического агентства.
            </p>
          </div>

          <div className="about-roles-grid">
            {clientCards.map((card) => (
              <article className="about-role-card" key={card.number}>
                <span>{card.number}</span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section motion-fade">
          <div className="about-section__head">
            <span className="home-hero__eyebrow">Подход</span>
            <h2>Как мы организуем поездку</h2>
            <p>
              Работа строится вокруг понятного пути клиента: от первого выбора
              направления до подтверждения заявки и подготовки к путешествию.
            </p>
          </div>

          <div className="about-process">
            {processItems.map((item, index) => (
              <article className="about-process-card" key={item.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-final motion-rise">
          <div>
            <span className="home-hero__eyebrow">Наша цель</span>
            <h2>Сделать выбор тура простым, прозрачным и спокойным</h2>
            <p>
              Мы берём на себя организационные детали, а клиент получает понятную
              карточку тура, актуальные условия, информацию по размещению,
              питанию, активностям и курорту перед оформлением поездки.
            </p>
          </div>

          <a href="/tours" className="site-button site-button--primary">
            Выбрать тур
          </a>
        </section>
      </div>
    </main>
  );
};

export default About;
