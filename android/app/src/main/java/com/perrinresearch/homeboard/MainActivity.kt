package com.perrinresearch.homeboard

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureFirebase(this)
        setContent {
            MaterialTheme {
                HomeBoardApp()
            }
        }
    }
}

fun ensureFirebase(context: Context) {
    if (FirebaseApp.getApps(context).isNotEmpty()) {
        return
    }
    if (BuildConfig.FIREBASE_API_KEY.isBlank() || BuildConfig.FIREBASE_APP_ID.isBlank() || BuildConfig.FIREBASE_PROJECT_ID.isBlank()) {
        return
    }
    FirebaseApp.initializeApp(
        context,
        FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .build()
    )
}

@Composable
fun HomeBoardApp() {
    val width = LocalConfiguration.current.smallestScreenWidthDp
    if (width >= 600) {
        TabletBoard()
        return
    }
    if (BuildConfig.FIREBASE_PROJECT_ID.isBlank()) {
        Message("Add android/firebase.properties from the Firebase project, then rebuild.")
        return
    }
    PhoneBoard(viewModel())
}

@Composable
fun PhoneBoard(model: BoardViewModel) {
    val signedIn by model.signedIn.collectAsStateWithLifecycle()
    if (!signedIn) {
        SignIn(model)
        return
    }
    val household by model.household.collectAsStateWithLifecycle()
    val error by model.error.collectAsStateWithLifecycle()
    var page by remember { mutableStateOf("chores") }
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = page == "chores",
                    onClick = { page = "chores" },
                    icon = {},
                    label = { Text("Chores") }
                )
                NavigationBarItem(
                    selected = page == "shopping",
                    onClick = { page = "shopping" },
                    icon = {},
                    label = { Text("Shopping") }
                )
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("HomeBoard", style = MaterialTheme.typography.titleLarge)
                TextButton(onClick = { model.signOut() }) { Text("Sign out") }
            }
            if (error.isNotBlank()) {
                Text(error, color = MaterialTheme.colorScheme.error)
            }
            if (page == "chores") {
                ChorePage(household, model)
            } else {
                ShoppingPage(household, model)
            }
        }
    }
}

@Composable
fun SignIn(model: BoardViewModel) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    val error by model.error.collectAsStateWithLifecycle()
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
    ) {
        Text("Join household", style = MaterialTheme.typography.headlineSmall)
        Text("Use the email and code shown in Settings on the board.")
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(code, { code = it }, label = { Text("Join code") }, modifier = Modifier.fillMaxWidth())
        if (error.isNotBlank()) {
            Text(error, color = MaterialTheme.colorScheme.error)
        }
        Button(onClick = { model.signIn(email, code) }, modifier = Modifier.fillMaxWidth()) {
            Text("Join")
        }
    }
}

@Composable
fun ChorePage(household: Household?, model: BoardViewModel) {
    val chores = household?.chores.orEmpty()
    val members = household?.members.orEmpty()
    var title by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(title, { title = it }, label = { Text("Add a chore") }, modifier = Modifier.weight(1f))
            Button(
                onClick = {
                    model.addChore(title, members.firstOrNull()?.id.orEmpty())
                    title = ""
                },
                modifier = Modifier.padding(start = 8.dp)
            ) { Text("Add") }
        }
        LazyColumn {
            items(chores, key = { it.id }) { chore ->
                val name = members.find { it.id == chore.assignedTo }?.name.orEmpty()
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(
                        checked = chore.completed,
                        onCheckedChange = { model.toggleChore(chore) }
                    )
                    Column {
                        Text(chore.title, style = MaterialTheme.typography.titleMedium)
                        if (name.isNotBlank()) {
                            Text(name, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ShoppingPage(household: Household?, model: BoardViewModel) {
    val items = household?.shopping.orEmpty()
    var title by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(title, { title = it }, label = { Text("Add an item") }, modifier = Modifier.weight(1f))
            Button(
                onClick = {
                    model.addShopping(title)
                    title = ""
                },
                modifier = Modifier.padding(start = 8.dp)
            ) { Text("Add") }
        }
        LazyColumn {
            items(items, key = { it.id }) { item ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Checkbox(
                        checked = item.checked,
                        onCheckedChange = { model.toggleShopping(item) }
                    )
                    Text(
                        if (item.quantity.isBlank()) item.title else "${item.title} (${item.quantity})",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TabletBoard() {
    val url = BuildConfig.BOARD_URL.ifBlank { "http://homeboard.local" }
    Column(Modifier.fillMaxSize()) {
        Text(
            "Full board",
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.titleMedium
        )
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    webViewClient = WebViewClient()
                    loadUrl(url)
                }
            }
        )
    }
}

@Composable
fun Message(text: String) {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Text(text)
    }
}
