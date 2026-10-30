USE library_management;

INSERT IGNORE INTO categories (name, description) VALUES
  ('Computer Science', 'Programming, software engineering, and computing'),
  ('Literature', 'Fiction, poetry, and literary works'),
  ('Business', 'Management, finance, and entrepreneurship'),
  ('Science', 'Natural sciences and mathematics'),
  ('History', 'World history and cultural studies'),
  ('Reference', 'Handbooks, dictionaries, and reference material');

INSERT IGNORE INTO authors (name, bio) VALUES
  ('Robert C. Martin', 'Software engineer and author known for practical software design.'),
  ('Jane Austen', 'English novelist whose works explore social relationships.'),
  ('Yuval Noah Harari', 'Historian and author of works on human history.'),
  ('Andrew S. Tanenbaum', 'Computer scientist and author of foundational computing texts.'),
  ('Peter Drucker', 'Management thinker and author on organizational practice.'),
  ('Carl Sagan', 'Astronomer and science communicator.');

INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-001', '9780132350884', 'Clean Code', id, 'Prentice Hall', 2008, '1st', 'A practical guide to writing readable, maintainable software.', 8, 8 FROM categories WHERE name = 'Computer Science';
INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-002', '9780141439518', 'Pride and Prejudice', id, 'Penguin Classics', 1813, 'Classic', 'A novel of manners, family, and first impressions.', 6, 6 FROM categories WHERE name = 'Literature';
INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-003', '9780062316097', 'Sapiens', id, 'Harper', 2015, 'Illustrated', 'A broad account of the history and development of humankind.', 5, 5 FROM categories WHERE name = 'History';
INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-004', '9780131103627', 'Operating Systems: Design and Implementation', id, 'Pearson', 2014, '3rd', 'An introduction to modern operating systems and their design.', 4, 4 FROM categories WHERE name = 'Computer Science';
INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-005', '9780060850524', 'The Effective Executive', id, 'Harper Business', 2006, 'Reprint', 'A guide to effectiveness and decision-making in organizations.', 3, 3 FROM categories WHERE name = 'Business';
INSERT IGNORE INTO books (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-006', '9780345539434', 'Cosmos', id, 'Ballantine Books', 2013, 'Reprint', 'An exploration of the universe and the scientific method.', 4, 4 FROM categories WHERE name = 'Science';

INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Robert C. Martin' WHERE b.isbn = '9780132350884';
INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Jane Austen' WHERE b.isbn = '9780141439518';
INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Yuval Noah Harari' WHERE b.isbn = '9780062316097';
INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Andrew S. Tanenbaum' WHERE b.isbn = '9780131103627';
INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Peter Drucker' WHERE b.isbn = '9780060850524';
INSERT IGNORE INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Carl Sagan' WHERE b.isbn = '9780345539434';

INSERT IGNORE INTO students (user_id, student_code, department, course, year_of_study)
SELECT id, 'STU-DEMO001', 'Computer Science', 'B.Sc. Computer Science', 3
FROM users WHERE email = 'student@library.local';

INSERT IGNORE INTO book_issues (issue_code, book_id, student_id, issued_by, issued_at, due_at, status)
SELECT 'ISS-DEMO001', b.id, s.id, (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       DATE_SUB(UTC_TIMESTAMP(), INTERVAL 12 DAY), DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY), 'issued'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001' WHERE b.isbn = '9780132350884';

INSERT IGNORE INTO book_issues (issue_code, book_id, student_id, issued_by, issued_at, due_at, status)
SELECT 'ISS-DEMO002', b.id, s.id, (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 DAY), DATE_SUB(CURRENT_DATE, INTERVAL 5 DAY), 'issued'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001' WHERE b.isbn = '9780141439518';

UPDATE books b SET b.available_copies = b.total_copies -
  (SELECT COUNT(*) FROM book_issues i WHERE i.book_id = b.id AND i.status IN ('issued','overdue'));
