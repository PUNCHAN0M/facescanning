# ✨ Quickstart ✨

## 🛠️ Project setup 🛠️

### Install Python 3.11

- `Linux`

```bash
brew install python@3.11
```

- `Windows`

```bash
winget install Python.Python.3.11
```

[Python download](https://www.python.org/downloads/)

---

### (Optional) Install pipx

- `Linux`

```bash
brew install pipx
pipx ensurepath
```

- `Windows`

```bash
python -m pip install --upgrade pipx
pipx ensurepath
```

[Pipx download](https://pipx.pypa.io/stable/installation/)

---

## ⚙️ Install Poetry ⚙️

```bash
pipx install poetry
```

[Poetry download](https://python-poetry.org/docs/)

### 🔨 Configure Poetry to create virtual environment in project 🔨

```bash
poetry config virtualenvs.in-project true
```

### 🔧 ! If you encounter issues because you are not using Python 3.11 as your main version, create and set the virtual environment 🔧

- `Linux`

```bash
poetry env use python3.11
```

- `Windows`

```bash
py -3.11 -c "import sys; print(sys.executable)"
```

```bash
poetry env use [full path\Python\Python311\python.exe]
```

---

## ⬇️ Install dependencies ⬇️

```bash
cd ai
poetry install
```

### 🔧 Setting Up Virtual Environment in VS Code 🔧

```bash
poetry env info --path
```

`Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)

`Python: Select Interpreter`

`Enter interpreter path...`

---

## 🚀 Compile and run 🚀

### 🧪 development

```bash
fastapi dev
```

### 🚀 production

```bash
fastapi run
```

---

## 🧹 Format documents 🧹

```bash
black .
```

---

## 📚 Documentation 📚

[FastAPI](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
