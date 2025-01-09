const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Kết nối MongoDB
mongoose.connect('mongodb+srv://root:123@cluster0.yf7zl.mongodb.net/vstep?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Kết nối MongoDB thành công'))
  .catch((err) => console.log('Kết nối MongoDB thất bại', err));

// Schema và model cho người dùng
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});
const User = mongoose.model('User', UserSchema);

// Schema và model cho câu hỏi
const QuestionSchema = new mongoose.Schema({
  question_id: Number, // Số ID của câu hỏi
  question_text: String, // Nội dung câu hỏi
  options: [ // Danh sách đáp án
    {
      key: String, // Ký hiệu đáp án (A, B, C, D...)
      text: String, // Nội dung đáp án
    },
  ],
  correct_answer: String, // Đáp án đúng
});

const Question = mongoose.model('Question', QuestionSchema);

// Route kiểm tra server
app.get('/', (req, res) => {
  res.send('Server đang chạy!');
});

// API đăng ký
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ message: 'Email đã được đăng ký' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = new User({ name, email, password: hashedPassword });
  await newUser.save();
  res.status(201).json({ message: 'Đăng ký thành công' });
});

// API đăng nhập
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });

  const token = jwt.sign({ userId: user._id }, 'secretkey', { expiresIn: '1h' });
  res.json({ message: 'Đăng nhập thành công', token });
});

// API lấy danh sách câu hỏi
app.get('/api/questions', async (req, res) => {
  try {
    // Lấy dữ liệu từ MongoDB
    const questions = await Question.find();

    // Đảm bảo dữ liệu được định dạng đúng
    const formattedQuestions = questions.map((q, index) => ({
      _id: q._id,
      question_id: index + 1, // Sử dụng index để đánh số thứ tự
      question_text: q.question_text || 'Câu hỏi không có nội dung.',
      options: Array.isArray(q.options)
  ? q.options.map((option) => ({
      key: option.key,
      text: option.text || 'Không có nội dung.',
    }))
  : [],

      correct_answer: q.correct_answer || 'Không có đáp án.',
    }));

    res.json(formattedQuestions); // Trả dữ liệu về cho frontend
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi lấy dữ liệu: ' + err.message });
  }
});

app.get('/api/audio/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, 'audio', fileName); // Thư mục chứa file audio

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Lỗi khi gửi file:', err);
      if (!res.headersSent) {
        return res.status(404).send('File không tồn tại.');
      }
    }
  });
});


const answerSchema = new mongoose.Schema({
  userId: String, // ID của người dùng
  questionId: String, // ID của câu hỏi
  selectedAnswer: String, // Đáp án đã chọn
  timestamp: { type: Date, default: Date.now }, // Thời gian
});

const Answer = mongoose.model('Answer', answerSchema);

app.post('/api/answers', async (req, res) => {
  try {
    const { userId, questionId, selectedAnswer } = req.body;

    if (!userId || !questionId || !selectedAnswer) {
      return res.status(400).json({ message: 'Thiếu dữ liệu bắt buộc!' });
    }

    // Tạo bản ghi mới
    const newAnswer = new Answer({ userId, questionId, selectedAnswer });
    await newAnswer.save();

    res.status(201).json({ message: 'Lưu câu trả lời thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

app.post('/results', async (req, res) => {
  try {
    const result = new Result(req.body);
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
 });
 app.get('/results', async (req, res) => {
  try {
    const results = await Result.find().sort({ date: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
 });

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
