INSERT INTO categories (name, description) VALUES
  ('Computer Science', 'Programming, software engineering, and computing'),
  ('Literature', 'Fiction, poetry, and literary works'),
  ('Business', 'Management, finance, and entrepreneurship'),
  ('Science', 'Natural sciences and mathematics'),
  ('History', 'World history and cultural studies'),
  ('Reference', 'Handbooks, dictionaries, and reference material')
ON CONFLICT (name) DO NOTHING;

INSERT INTO authors (name, bio) VALUES
  ('Robert C. Martin', 'Software engineer and author known for practical software design.'),
  ('Jane Austen', 'English novelist whose works explore social relationships.'),
  ('Yuval Noah Harari', 'Historian and author of works on human history.'),
  ('Andrew S. Tanenbaum', 'Computer scientist and author of foundational computing texts.'),
  ('Peter Drucker', 'Management thinker and author on organizational practice.'),
  ('Carl Sagan', 'Astronomer and science communicator.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-001', '9780132350884', 'Clean Code', id, 'Prentice Hall', 2008, '1st',
       'A practical guide to writing readable, maintainable software.', 8, 8
FROM categories WHERE name = 'Computer Science'
ON CONFLICT (isbn) DO NOTHING;
INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-002', '9780141439518', 'Pride and Prejudice', id, 'Penguin Classics', 1813, 'Classic',
       'A novel of manners, family, and first impressions.', 6, 6
FROM categories WHERE name = 'Literature'
ON CONFLICT (isbn) DO NOTHING;
INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-003', '9780062316097', 'Sapiens', id, 'Harper', 2015, 'Illustrated',
       'A broad account of the history and development of humankind.', 5, 5
FROM categories WHERE name = 'History'
ON CONFLICT (isbn) DO NOTHING;
INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-004', '9780131103627', 'Operating Systems: Design and Implementation', id, 'Pearson', 2014, '3rd',
       'An introduction to modern operating systems and their design.', 4, 4
FROM categories WHERE name = 'Computer Science'
ON CONFLICT (isbn) DO NOTHING;
INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-005', '9780060850524', 'The Effective Executive', id, 'Harper Business', 2006, 'Reprint',
       'A guide to effectiveness and decision-making in organizations.', 3, 3
FROM categories WHERE name = 'Business'
ON CONFLICT (isbn) DO NOTHING;
INSERT INTO books
  (book_code, isbn, title, category_id, publisher, publication_year, edition, description, total_copies, available_copies)
SELECT 'BK-006', '9780345539434', 'Cosmos', id, 'Ballantine Books', 2013, 'Reprint',
       'An exploration of the universe and the scientific method.', 1, 1
FROM categories WHERE name = 'Science'
ON CONFLICT (isbn) DO NOTHING;

INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Robert C. Martin' WHERE b.isbn = '9780132350884'
ON CONFLICT DO NOTHING;
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Jane Austen' WHERE b.isbn = '9780141439518'
ON CONFLICT DO NOTHING;
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Yuval Noah Harari' WHERE b.isbn = '9780062316097'
ON CONFLICT DO NOTHING;
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Andrew S. Tanenbaum' WHERE b.isbn = '9780131103627'
ON CONFLICT DO NOTHING;
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Peter Drucker' WHERE b.isbn = '9780060850524'
ON CONFLICT DO NOTHING;
INSERT INTO book_authors (book_id, author_id)
SELECT b.id, a.id FROM books b JOIN authors a ON a.name = 'Carl Sagan' WHERE b.isbn = '9780345539434'
ON CONFLICT DO NOTHING;

INSERT INTO students (user_id, student_code, department, course, year_of_study, address)
SELECT id, 'STU-DEMO001', 'Computer Science', 'B.Sc. Computer Science', 3, '12 College Road'
FROM users WHERE email = 'student@library.local'
ON CONFLICT (student_code) DO NOTHING;

INSERT INTO book_issues
  (issue_code, book_id, student_id, issued_by, issued_at, due_at, status)
SELECT 'ISS-DEMO001', b.id, s.id,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       CURRENT_TIMESTAMP - INTERVAL '12 days', CURRENT_DATE + 2, 'issued'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001'
WHERE b.isbn = '9780132350884'
ON CONFLICT (issue_code) DO NOTHING;
INSERT INTO book_issues
  (issue_code, book_id, student_id, issued_by, issued_at, due_at, status)
SELECT 'ISS-DEMO002', b.id, s.id,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       CURRENT_TIMESTAMP - INTERVAL '24 days', CURRENT_DATE - 5, 'overdue'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001'
WHERE b.isbn = '9780141439518'
ON CONFLICT (issue_code) DO NOTHING;
INSERT INTO book_issues
  (issue_code, book_id, student_id, issued_by, issued_at, due_at, returned_at, status)
SELECT 'ISS-DEMO003', b.id, s.id,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_DATE - 16,
       CURRENT_TIMESTAMP - INTERVAL '14 days', 'returned'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001'
WHERE b.isbn = '9780062316097'
ON CONFLICT (issue_code) DO NOTHING;
INSERT INTO book_issues
  (issue_code, book_id, student_id, issued_by, issued_at, due_at, status)
SELECT 'ISS-DEMO004', b.id, s.id,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
       CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_DATE + 11, 'issued'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001'
WHERE b.isbn = '9780345539434'
ON CONFLICT (issue_code) DO NOTHING;

INSERT INTO reservations (reservation_code, book_id, student_id, status, queued_at)
SELECT 'RES-DEMO001', b.id, s.id, 'pending', CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM books b JOIN students s ON s.student_code = 'STU-DEMO001'
WHERE b.isbn = '9780345539434'
ON CONFLICT (reservation_code) DO NOTHING;

INSERT INTO fines (issue_id, student_id, amount, paid_amount, status)
SELECT i.id, i.student_id, 10.00, 4.00, 'partial'
FROM book_issues i WHERE i.issue_code = 'ISS-DEMO002'
ON CONFLICT (issue_id) DO NOTHING;
INSERT INTO fines (issue_id, student_id, amount, paid_amount, status)
SELECT i.id, i.student_id, 4.00, 4.00, 'paid'
FROM book_issues i WHERE i.issue_code = 'ISS-DEMO003'
ON CONFLICT (issue_id) DO NOTHING;

INSERT INTO payments (fine_id, recorded_by, amount, method, reference, paid_at)
SELECT f.id, u.id, 4.00, 'other', 'DEMO-PAY-001', CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM fines f
JOIN book_issues i ON i.id = f.issue_id AND i.issue_code = 'ISS-DEMO002'
JOIN (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1) u ON TRUE
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.reference = 'DEMO-PAY-001');
INSERT INTO payments (fine_id, recorded_by, amount, method, reference, paid_at)
SELECT f.id, u.id, 4.00, 'cash', 'DEMO-PAY-002', CURRENT_TIMESTAMP - INTERVAL '14 days'
FROM fines f
JOIN book_issues i ON i.id = f.issue_id AND i.issue_code = 'ISS-DEMO003'
JOIN (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1) u ON TRUE
WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.reference = 'DEMO-PAY-002');

INSERT INTO notifications (user_id, type, title, message, created_at)
SELECT s.user_id, 'reminder', 'Book due soon', 'Loan ISS-DEMO001: Clean Code is due in two days.', CURRENT_TIMESTAMP
FROM students s WHERE s.student_code = 'STU-DEMO001'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = s.user_id AND n.type = 'reminder'
      AND n.message = 'Loan ISS-DEMO001: Clean Code is due in two days.'
  );
INSERT INTO notifications (user_id, type, title, message, created_at)
SELECT s.user_id, 'fine', 'Fine payment recorded', 'A payment of 4.00 was recorded for loan ISS-DEMO002.',
       CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM students s WHERE s.student_code = 'STU-DEMO001'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = s.user_id AND n.type = 'fine'
      AND n.message = 'A payment of 4.00 was recorded for loan ISS-DEMO002.'
  );

UPDATE books b SET available_copies = b.total_copies -
  (SELECT COUNT(*) FROM book_issues i WHERE i.book_id = b.id AND i.status IN ('issued', 'overdue'))
WHERE b.book_code IN ('BK-001', 'BK-002', 'BK-003', 'BK-004', 'BK-005', 'BK-006');
