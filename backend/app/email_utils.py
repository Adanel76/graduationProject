import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta

# Загружаем переменные окружения
load_dotenv()

def generate_verification_code(length: int = 6) -> str:
    """Генерация случайного 6-значного кода подтверждения"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])

def generate_reset_code(length: int = 6) -> str:
    """Генерация случайного 6-значного кода сброса пароля"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])

def send_verification_email(email: str, verification_code: str):
    """Отправка email с кодом подтверждения регистрации"""
    
    # Настройки SMTP
    smtp_server = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 587))
    sender_email = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Создаем сообщение
    message = MIMEMultipart("alternative")
    message["Subject"] = "Подтверждение регистрации - Travel Agency"
    message["From"] = sender_email
    message["To"] = email
    
    # HTML содержимое
    html_content = f"""
    <html>
    <body>
        <h2>Подтверждение регистрации</h2>
        <p>Здравствуйте!</p>
        <p>Спасибо за регистрацию в Travel Agency.</p>
        <p>Ваш код подтверждения: <strong style="font-size: 24px; color: #3498db;">{verification_code}</strong></p>
        <p>Введите этот код на странице подтверждения email.</p>
        <p>Код действителен в течение 24 часов.</p>
        <br>
        <p>С уважением,<br>Команда Travel Agency</p>
    </body>
    </html>
    """
    
    # Создаем HTML часть
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Создаем контекст SSL
    context = ssl.create_default_context()
    
    try:
        # Подключаемся к серверу
        server = smtplib.SMTP(smtp_server, port)
        server.starttls(context=context)  # Защищенное соединение
        server.login(sender_email, password)
        
        # Отправляем email
        server.sendmail(sender_email, email, message.as_string())
        server.quit()
        
        print(f"Код подтверждения отправлен на {email}: {verification_code}")
        return True
        
    except Exception as e:
        print(f"Ошибка отправки email подтверждения: {e}")
        raise Exception(f"Не удалось отправить email подтверждения: {str(e)}")

def send_reset_password_email(email: str, reset_code: str):
    """Отправка email с кодом сброса пароля"""
    
    # Настройки SMTP
    smtp_server = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 587))
    sender_email = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Создаем сообщение
    message = MIMEMultipart("alternative")
    message["Subject"] = "Сброс пароля - Travel Agency"
    message["From"] = sender_email
    message["To"] = email
    
    # HTML содержимое
    html_content = f"""
    <html>
    <body>
        <h2>Сброс пароля</h2>
        <p>Здравствуйте!</p>
        <p>Вы запросили сброс пароля для вашего аккаунта.</p>
        <p>Ваш код подтверждения: <strong style="font-size: 24px; color: #3498db;">{reset_code}</strong></p>
        <p>Введите этот код на странице сброса пароля.</p>
        <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
        <br>
        <p>С уважением,<br>Команда Travel Agency</p>
    </body>
    </html>
    """
    
    # Создаем HTML часть
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Создаем контекст SSL
    context = ssl.create_default_context()
    
    try:
        # Подключаемся к серверу
        server = smtplib.SMTP(smtp_server, port)
        server.starttls(context=context)  # Защищенное соединение
        server.login(sender_email, password)
        
        # Отправляем email
        server.sendmail(sender_email, email, message.as_string())
        server.quit()
        
        print(f"Email сброса пароля отправлен на {email} с кодом {reset_code}")
        return True
        
    except Exception as e:
        print(f"Ошибка отправки email сброса пароля: {e}")
        raise Exception(f"Не удалось отправить email сброса пароля: {str(e)}")

def send_booking_confirmation_email(email: str, booking_data: dict):
    """Отправка email с подтверждением бронирования"""
    
    # Настройки SMTP
    smtp_server = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 587))
    sender_email = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Создаем сообщение
    message = MIMEMultipart("alternative")
    message["Subject"] = f"Подтверждение бронирования тура - {booking_data['tour_title']}"
    message["From"] = sender_email
    message["To"] = email
    
    # HTML содержимое с детальной информацией
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background-color: #3498db; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">Travel Agency</h1>
                <h2 style="margin: 10px 0 0 0;">Подтверждение бронирования</h2>
            </div>
            
            <div style="background-color: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #2c3e50;">Здравствуйте, {booking_data['user_name']}!</h2>
                
                <p>Ваше бронирование успешно оформлено. Ниже приведены детали вашего заказа:</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Детали тура</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Название тура:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data['tour_title']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Место:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data.get('tour_location', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Даты:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data.get('tour_dates', '')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Длительность:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data.get('tour_duration', '')}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Детали бронирования</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Номер бронирования:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">#{booking_data['booking_id']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Дата бронирования:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data['booking_date']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Количество человек:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data['people_count']}</td>
                        </tr>
                        {booking_data.get('discount_info', '') and f"""
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Скидка:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #27ae60;">{booking_data['discount_info']}</td>
                        </tr>
                        """ or ''}
                        <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #eee;"><strong>Итоговая цена:</strong></td>
                            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-size: 18px; font-weight: bold; color: #e74c3c;">{booking_data['final_price']}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #1976d2;">Статус бронирования</h3>
                    <p style="margin: 0;"><span style="background-color: #f39c12; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold;">Ожидает подтверждения</span></p>
                    <p style="margin-top: 10px;">Наш менеджер свяжется с вами в ближайшее время для подтверждения бронирования.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/profile" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Посмотреть бронирование
                    </a>
                </div>
                
                <p>Если у вас есть вопросы, свяжитесь с нами по телефону или email.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 14px;">
                    <p>С уважением,<br><strong>Команда Travel Agency</strong></p>
                    <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Создаем HTML часть
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Создаем контекст SSL
    context = ssl.create_default_context()
    
    try:
        # Подключаемся к серверу
        server = smtplib.SMTP(smtp_server, port)
        server.starttls(context=context)  # Защищенное соединение
        server.login(sender_email, password)
        
        # Отправляем email
        server.sendmail(sender_email, email, message.as_string())
        server.quit()
        
        print(f"Email подтверждения бронирования отправлен на {email}")
        return True
        
    except Exception as e:
        print(f"Ошибка отправки email подтверждения бронирования: {e}")
        raise Exception(f"Не удалось отправить email подтверждения бронирования: {str(e)}")

def send_booking_status_update_email(email: str, booking_data: dict):
    """Отправка email с обновлением статуса бронирования"""
    
    # Настройки SMTP
    smtp_server = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 587))
    sender_email = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Определяем цвет статуса
    status_colors = {
        'confirmed': '#27ae60',
        'cancelled': '#e74c3c',
        'pending': '#f39c12'
    }
    
    status_texts = {
        'confirmed': 'Подтверждено',
        'cancelled': 'Отменено',
        'pending': 'Ожидает подтверждения'
    }
    
    status_color = status_colors.get(booking_data['status'], '#95a5a6')
    status_text = status_texts.get(booking_data['status'], booking_data['status'])
    
    # Создаем сообщение
    message = MIMEMultipart("alternative")
    message["Subject"] = f"Обновление статуса бронирования - {booking_data['tour_title']}"
    message["From"] = sender_email
    message["To"] = email
    
    # HTML содержимое
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background-color: #3498db; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">Travel Agency</h1>
                <h2 style="margin: 10px 0 0 0;">Обновление статуса бронирования</h2>
            </div>
            
            <div style="background-color: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #2c3e50;">Здравствуйте, {booking_data['user_name']}!</h2>
                
                <p>Статус вашего бронирования был обновлен. Ниже приведены актуальные детали:</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Детали тура</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Название тура:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data['tour_title']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Номер бронирования:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">#{booking_data['booking_id']}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Дата бронирования:</strong></td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">{booking_data['booking_date']}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <h3 style="margin-top: 0; color: #1976d2;">Новый статус бронирования</h3>
                    <p style="margin: 0;"><span style="background-color: {status_color}; color: white; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 18px;">{status_text}</span></p>
                </div>
                
                {booking_data['status'] == 'cancelled' and '''
                <div style="background-color: #fdf2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
                    <h3 style="margin-top: 0; color: #e74c3c;">Бронирование отменено</h3>
                    <p>К сожалению, ваше бронирование было отменено. Приносим свои извинения.</p>
                    <p>Если у вас есть вопросы, пожалуйста, свяжитесь с нашей службой поддержки.</p>
                </div>
                ''' or ''}
                
                {booking_data['status'] == 'confirmed' and '''
                <div style="background-color: #f2fdf2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                    <h3 style="margin-top: 0; color: #27ae60;">Бронирование подтверждено!</h3>
                    <p>Ваш тур подтвержден! Ждем вас в назначенную дату.</p>
                    <p>Дополнительная информация будет отправлена за неделю до начала тура.</p>
                </div>
                ''' or ''}
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/profile" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Посмотреть бронирование
                    </a>
                </div>
                
                <p>Если у вас есть вопросы, свяжитесь с нами по телефону или email.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 14px;">
                    <p>С уважением,<br><strong>Команда Travel Agency</strong></p>
                    <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Создаем HTML часть
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Создаем контекст SSL
    context = ssl.create_default_context()
    
    try:
        # Подключаемся к серверу
        server = smtplib.SMTP(smtp_server, port)
        server.starttls(context=context)  # Защищенное соединение
        server.login(sender_email, password)
        
        # Отправляем email
        server.sendmail(sender_email, email, message.as_string())
        server.quit()
        
        print(f"Email обновления статуса бронирования отправлен на {email}")
        return True
        
    except Exception as e:
        print(f"Ошибка отправки email обновления статуса бронирования: {e}")
        raise Exception(f"Не удалось отправить email обновления статуса бронирования: {str(e)}")

def send_welcome_email(email: str, user_name: str):
    """Отправка приветственного email после регистрации"""
    
    # Настройки SMTP
    smtp_server = os.getenv("EMAIL_HOST")
    port = int(os.getenv("EMAIL_PORT", 587))
    sender_email = os.getenv("EMAIL_FROM")
    password = os.getenv("EMAIL_PASSWORD")
    
    # Создаем сообщение
    message = MIMEMultipart("alternative")
    message["Subject"] = "Добро пожаловать в Travel Agency!"
    message["From"] = sender_email
    message["To"] = email
    
    # HTML содержимое
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; background-color: #3498db; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0;">Travel Agency</h1>
                <h2 style="margin: 10px 0 0 0;">Добро пожаловать!</h2>
            </div>
            
            <div style="background-color: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
                <h2 style="color: #2c3e50;">Здравствуйте, {user_name}!</h2>
                
                <p>Поздравляем с успешной регистрацией в нашем туристическом агентстве!</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #2c3e50;">Что вы можете делать:</h3>
                    <ul style="padding-left: 20px;">
                        <li style="margin-bottom: 10px;">Просматривать и бронировать туры</li>
                        <li style="margin-bottom: 10px;">Оставлять отзывы о посещенных турах</li>
                        <li style="margin-bottom: 10px;">Отслеживать статус своих бронирований</li>
                        <li style="margin-bottom: 10px;">Получать персональные предложения</li>
                        <li>Сохранять любимые туры в избранное</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/tours" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Посмотреть туры
                    </a>
                </div>
                
                <p>Если у вас есть вопросы, не стесняйтесь обращаться к нам!</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 14px;">
                    <p>С уважением,<br><strong>Команда Travel Agency</strong></p>
                    <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Создаем HTML часть
    html_part = MIMEText(html_content, "html")
    message.attach(html_part)
    
    # Создаем контекст SSL
    context = ssl.create_default_context()
    
    try:
        # Подключаемся к серверу
        server = smtplib.SMTP(smtp_server, port)
        server.starttls(context=context)  # Защищенное соединение
        server.login(sender_email, password)
        
        # Отправляем email
        server.sendmail(sender_email, email, message.as_string())
        server.quit()
        
        print(f"Приветственный email отправлен на {email}")
        return True
        
    except Exception as e:
        print(f"Ошибка отправки приветственного email: {e}")
        raise Exception(f"Не удалось отправить приветственный email: {str(e)}")
